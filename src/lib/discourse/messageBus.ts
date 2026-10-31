// Minimal Discourse MessageBus client (long polling).
// Protocol: https://github.com/discourse/message_bus#transport
// POST /message-bus/<clientId>/poll with `channel=lastId` pairs; the server holds
// the request open (~25s) until something is published, then returns an array
// of { channel, message_id, data }. A /__status entry resets our last ids.

import { discourse, DiscourseError } from './client'

type Callback = (data: any) => void

interface BusMessage {
  channel: string
  message_id: number
  data: any
}

export type BusState = 'connecting' | 'connected' | 'failing'

export class MessageBus {
  private subs = new Map<string, { lastId: number; callbacks: Set<Callback> }>()
  private clientId = crypto.randomUUID().replace(/-/g, '')
  private controller: AbortController | null = null
  private running = false
  /** Bumped on stop() so a poll loop that outlives it exits instead of running twice. */
  private generation = 0
  private failures = 0
  private stateListeners = new Set<(s: BusState, failures: number) => void>()

  subscribe(channel: string, callback: Callback, lastId = -1) {
    let sub = this.subs.get(channel)
    if (!sub) {
      sub = { lastId, callbacks: new Set() }
      this.subs.set(channel, sub)
    }
    sub.callbacks.add(callback)
    this.restart()
    return () => {
      sub.callbacks.delete(callback)
      if (!sub.callbacks.size) this.subs.delete(channel)
      if (!this.subs.size) this.stop()
      else this.restart()
    }
  }

  onState(listener: (s: BusState, failures: number) => void) {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  private emit(state: BusState) {
    this.stateListeners.forEach((l) => l(state, this.failures))
  }

  /** Abort the open poll so the next one includes the current subscriptions. */
  private restart() {
    if (this.running) this.controller?.abort()
    else void this.loop()
  }

  stop() {
    this.running = false
    this.generation++
    this.controller?.abort()
  }

  private async loop() {
    this.running = true
    const generation = this.generation
    this.emit('connecting')
    while (this.running && generation === this.generation && this.subs.size) {
      const controller = (this.controller = new AbortController())
      const body = new URLSearchParams()
      for (const [channel, sub] of this.subs) body.set(channel, String(sub.lastId))
      try {
        const messages = await discourse.request<BusMessage[]>(`/message-bus/${this.clientId}/poll`, {
          method: 'POST',
          body,
          signal: controller.signal,
          headers: { 'Dont-Chunk': 'true', 'X-SILENCE-LOGGER': 'true' },
        })
        if (this.failures || !messages.length) this.emit('connected')
        this.failures = 0
        this.deliver(messages ?? [])
      } catch (e) {
        if (controller.signal.aborted) continue
        this.failures++
        this.emit('failing')
        if (e instanceof DiscourseError && e.isAuthError) break
        // Back off: 1s, 2s, 4s... capped at 30s.
        await sleep(Math.min(30_000, 1000 * 2 ** Math.min(this.failures - 1, 5)))
      }
    }
    if (generation === this.generation) this.running = false
  }

  private deliver(messages: BusMessage[]) {
    for (const m of messages) {
      if (m.channel === '/__status') {
        for (const [channel, id] of Object.entries(m.data as Record<string, number>)) {
          const sub = this.subs.get(channel)
          if (sub) sub.lastId = id
        }
        continue
      }
      const sub = this.subs.get(m.channel)
      if (!sub) continue
      sub.lastId = m.message_id
      sub.callbacks.forEach((cb) => {
        try {
          cb(m.data)
        } catch (err) {
          console.error('MessageBus callback failed', err)
        }
      })
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const messageBus = new MessageBus()
