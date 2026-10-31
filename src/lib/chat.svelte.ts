// Live chat state for one room: loads history, follows the channel over the
// MessageBus (falling back to polling if the bus can't connect, e.g. CORS),
// and sends messages and reactions optimistically.

import {
  fetchMessages,
  joinChannel,
  normalise,
  react,
  resolveChannel,
  sendMessage,
  type ChatChannel,
  type ChatMessage,
  type ChatUser,
} from './discourse/chat'
import { DiscourseError } from './discourse/client'
import { messageBus } from './discourse/messageBus'
import type { CurrentUser } from './discourse/types'
import type { Room } from './rooms'

export type ChatStatus = 'loading' | 'live' | 'polling' | 'reconnecting' | 'error'

/** Bus failures in a row before we start polling as well. */
const POLL_AFTER_FAILURES = 2
const POLL_INTERVAL_MS = 5000

export class ChatRoom {
  channel = $state<ChatChannel | null>(null)
  messages = $state<ChatMessage[]>([])
  status = $state<ChatStatus>('loading')
  error = $state<string | null>(null)
  /** Problem with the last send/react, shown briefly above the composer. */
  notice = $state<string | null>(null)
  canLoadMore = $state(false)
  loadingMore = $state(false)

  private cleanups: (() => void)[] = []
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private joined = false
  private stopped = false

  constructor(
    private room: Room,
    private me: CurrentUser,
  ) {}

  async start() {
    try {
      const channel = await resolveChannel(this.room)
      if (this.stopped) return
      this.channel = channel
      this.joined = !!channel.current_user_membership?.following

      const lastId = channel.meta?.message_bus_last_ids?.channel_message_bus_last_id ?? -1
      this.cleanups.push(messageBus.subscribe(`/chat/${channel.id}`, (data) => this.onBus(data), lastId))
      this.cleanups.push(
        messageBus.onState((state, failures) => {
          if (state === 'connected') {
            const wasDown = this.status !== 'live'
            this.stopPolling()
            this.status = 'live'
            if (wasDown && this.messages.length) void this.catchUp()
          } else if (state === 'failing' && failures >= POLL_AFTER_FAILURES) {
            this.startPolling()
          } else if (state === 'failing' && this.status === 'live') {
            this.status = 'reconnecting'
          }
        }),
      )

      const page = await fetchMessages(channel.id)
      if (this.stopped) return
      this.messages = sort(page.messages)
      this.canLoadMore = page.canLoadMore
      if (this.status === 'loading') this.status = 'live'
    } catch (e) {
      this.status = 'error'
      this.error = e instanceof Error ? e.message : String(e)
    }
  }

  stop() {
    this.stopped = true
    this.stopPolling()
    this.cleanups.forEach((c) => c())
    this.cleanups = []
  }

  async loadOlder() {
    const oldest = this.messages.find((m) => m.id > 0)
    if (!this.channel || !oldest || this.loadingMore) return
    this.loadingMore = true
    try {
      const page = await fetchMessages(this.channel.id, { before: oldest.id })
      this.merge(page.messages)
      this.canLoadMore = page.canLoadMore
    } catch (e) {
      this.flash(e)
    } finally {
      this.loadingMore = false
    }
  }

  async send(text: string) {
    const message = text.trim()
    if (!message || !this.channel) return
    const staged: ChatMessage = {
      id: -Date.now(),
      staged_id: crypto.randomUUID(),
      message,
      cooked: '',
      created_at: new Date().toISOString(),
      user: this.me as ChatUser,
      reactions: [],
      pending: true,
    }
    this.messages.push(staged)
    await this.deliver(staged)
  }

  async retry(staged: ChatMessage) {
    const m = this.messages.find((x) => x.staged_id === staged.staged_id)
    if (!m) return
    m.failed = false
    m.pending = true
    await this.deliver(m)
  }

  discard(staged: ChatMessage) {
    this.messages = this.messages.filter((x) => x.staged_id !== staged.staged_id)
  }

  private async deliver(staged: ChatMessage) {
    const channelId = this.channel!.id
    try {
      if (!this.joined) {
        await joinChannel(channelId).catch(() => {})
        this.joined = true
      }
      const res = await sendMessage(channelId, staged.message, staged.staged_id!)
      const m = this.messages.find((x) => x.staged_id === staged.staged_id)
      // The bus usually beats the POST response; if not, adopt the real id now.
      if (m && m.id < 0 && res?.message_id) {
        if (this.messages.some((x) => x.id === res.message_id)) this.discard(staged)
        else m.id = res.message_id
      }
      if (this.status === 'polling') void this.catchUp()
    } catch (e) {
      const m = this.messages.find((x) => x.staged_id === staged.staged_id)
      if (m) {
        m.pending = false
        m.failed = true
      }
      this.flash(e)
    }
  }

  async toggleReaction(message: ChatMessage, emoji: string) {
    if (!this.channel || message.id < 0) return
    const existing = message.reactions.find((r) => r.emoji === emoji)
    const action = existing?.reacted ? 'remove' : 'add'
    this.applyReaction(message.id, emoji, action, true)
    try {
      await react(this.channel.id, message.id, emoji, action)
    } catch (e) {
      this.applyReaction(message.id, emoji, action === 'add' ? 'remove' : 'add', true)
      this.flash(e)
    }
  }

  /** Is this message addressed to me (@mention)? */
  mentionsMe(m: ChatMessage) {
    const name = this.me.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^\\w])@${name}(?![\\w-])`, 'i').test(m.message)
  }

  // --- live updates -------------------------------------------------------

  private onBus(data: any) {
    switch (data?.type) {
      case 'sent':
        return this.onSent(normalise(data.chat_message), data.staged_id ?? data.chat_message?.staged_id)
      case 'edit':
      case 'restore':
      case 'processed': {
        const m = this.messages.find((x) => x.id === data.chat_message?.id)
        if (m) Object.assign(m, data.type === 'processed' ? { cooked: data.chat_message.cooked } : normalise(data.chat_message))
        else if (data.type === 'restore') this.merge([normalise(data.chat_message)])
        return
      }
      case 'reaction': {
        const mine = data.user?.id === this.me.id
        return this.applyReaction(data.chat_message_id, data.emoji, data.action, mine)
      }
      case 'delete':
      case 'bulk_delete': {
        const ids = new Set<number>(data.deleted_ids ?? [data.deleted_id])
        this.messages = this.messages.filter((m) => !ids.has(m.id))
        return
      }
    }
  }

  private onSent(message: ChatMessage, stagedId?: string) {
    const staged =
      (stagedId && this.messages.find((m) => m.staged_id === stagedId)) ||
      this.messages.find((m) => m.id === message.id)
    if (staged) Object.assign(staged, message, { pending: false, failed: false })
    else this.messages.push(message)
    this.messages = sort(this.messages)
  }

  private applyReaction(messageId: number, emoji: string, action: 'add' | 'remove', mine: boolean) {
    const m = this.messages.find((x) => x.id === messageId)
    if (!m) return
    let r = m.reactions.find((x) => x.emoji === emoji)
    // Our own reaction echoes back over the bus after we applied it optimistically.
    if (mine && r && r.reacted === (action === 'add')) return
    if (!r) {
      if (action === 'remove') return
      r = { emoji, count: 0, reacted: false }
      m.reactions.push(r)
      r = m.reactions[m.reactions.length - 1]
    }
    r.count += action === 'add' ? 1 : -1
    if (mine) r.reacted = action === 'add'
    if (r.count <= 0) m.reactions = m.reactions.filter((x) => x.emoji !== emoji)
  }

  // --- polling fallback ---------------------------------------------------

  private startPolling() {
    if (this.pollTimer || this.stopped) return
    this.status = 'polling'
    void this.catchUp()
    this.pollTimer = setInterval(() => void this.catchUp(), POLL_INTERVAL_MS)
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  /** Refetch the latest page and fold it in (new messages, reactions, edits). */
  private async catchUp() {
    if (!this.channel || document.hidden) return
    try {
      const page = await fetchMessages(this.channel.id)
      const latest = new Set(page.messages.map((m) => m.id))
      const oldestLatest = page.messages[0]?.id ?? Infinity
      // Anything in the latest page's range that's gone was deleted.
      this.messages = this.messages.filter((m) => m.id < oldestLatest || latest.has(m.id) || m.id < 0)
      this.merge(page.messages)
    } catch (e) {
      if (e instanceof DiscourseError && e.isAuthError) this.stopPolling()
    }
  }

  private merge(incoming: ChatMessage[]) {
    for (const msg of incoming) {
      let i = this.messages.findIndex((m) => m.id === msg.id || (msg.staged_id && m.staged_id === msg.staged_id))
      // Without the bus we never learn the staged id; match our own pending message by text.
      if (i < 0 && msg.user.id === this.me.id) {
        i = this.messages.findIndex((m) => m.id < 0 && m.pending && m.message === msg.message)
      }
      if (i >= 0) this.messages[i] = { ...msg, pending: false, failed: false }
      else this.messages.push(msg)
    }
    this.messages = sort(this.messages)
  }

  private flash(e: unknown) {
    this.notice = e instanceof Error ? e.message : String(e)
    setTimeout(() => (this.notice = null), 6000)
  }
}

/** Oldest first; messages still being sent stay at the end. */
function sort(list: ChatMessage[]) {
  return [...list].sort((a, b) => {
    if (a.id < 0 !== b.id < 0) return a.id < 0 ? 1 : -1
    return a.id < 0 ? b.id - a.id : a.id - b.id
  })
}
