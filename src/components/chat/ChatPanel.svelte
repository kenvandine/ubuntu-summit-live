<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { ChatRoom } from '../../lib/chat.svelte'
  import type { ChatMessage, ChatUser } from '../../lib/discourse/chat'
  import type { CurrentUser } from '../../lib/discourse/types'
  import type { Room } from '../../lib/rooms'
  import ChatMessageItem from './ChatMessageItem.svelte'
  import Composer from './Composer.svelte'

  let { room, me }: { room: Room; me: CurrentUser } = $props()

  // svelte-ignore state_referenced_locally (one ChatRoom per mounted panel; Room is keyed by slug)
  const chat = new ChatRoom(room, me)
  let scroller: HTMLElement
  let list: HTMLElement
  let atBottom = $state(true)
  let unseen = $state(0)
  let activeId = $state<number | null>(null)
  let lastCount = 0

  const GROUP_MS = 5 * 60 * 1000
  const grouped = (m: ChatMessage, prev?: ChatMessage) =>
    !!prev &&
    prev.user.id === m.user.id &&
    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS

  const recentUsers = $derived.by(() => {
    const seen = new Map<string, ChatUser>()
    for (let i = chat.messages.length - 1; i >= 0 && seen.size < 30; i--) {
      const u = chat.messages[i].user
      if (u.username !== me.username && !seen.has(u.username)) seen.set(u.username, u)
    }
    return [...seen.values()]
  })

  const statusLabel = $derived(
    {
      loading: 'Connecting…',
      live: 'Live',
      polling: 'Live (slow updates)',
      reconnecting: 'Reconnecting…',
      error: 'Offline',
    }[chat.status],
  )

  onMount(() => {
    void chat.start()
    // Reactions, images and grouped lines change heights without adding messages;
    // stay pinned to the newest message through those too.
    const observer = new ResizeObserver(() => {
      if (atBottom) scroller.scrollTop = scroller.scrollHeight
    })
    observer.observe(list)
    return () => observer.disconnect()
  })
  onDestroy(() => chat.stop())

  // Keep the newest message in view while the reader is at the bottom.
  $effect(() => {
    const count = chat.messages.length
    const last = chat.messages[count - 1]
    const added = count - lastCount
    lastCount = count
    if (!added) return
    const ownMessage = last?.user.username === me.username && last.id < 0
    if (atBottom || ownMessage || added === count) {
      void tick().then(() => scrollToBottom(added === count ? 'instant' : 'smooth'))
    } else if (added > 0 && last?.id > 0) {
      unseen += added
    }
  })

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior })
    unseen = 0
  }

  function onscroll() {
    atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48
    if (atBottom) unseen = 0
    if (scroller.scrollTop < 80 && chat.canLoadMore && !chat.loadingMore) void loadOlder()
  }

  async function loadOlder() {
    // Keep the reader's place while older messages are added above.
    const fromBottom = scroller.scrollHeight - scroller.scrollTop
    lastCount = Number.MAX_SAFE_INTEGER
    await chat.loadOlder()
    lastCount = chat.messages.length
    await tick()
    scroller.scrollTop = scroller.scrollHeight - fromBottom
  }

  function onsend(text: string) {
    activeId = null
    void chat.send(text)
  }
</script>

<svelte:window
  onclick={(e) => {
    if (activeId !== null && !(e.target as HTMLElement).closest('.msg')) activeId = null
  }}
/>

<section class="chat" aria-label="Live chat">
  <header class="chat-header">
    <h2>Live chat</h2>
    <span class="status" data-status={chat.status} title={statusLabel}>
      <span class="dot" aria-hidden="true"></span>
      {#if chat.status === 'live' && chat.channel?.memberships_count}
        {chat.channel.memberships_count.toLocaleString()} in chat
      {:else}
        {statusLabel}
      {/if}
    </span>
  </header>

  <div class="scroller" bind:this={scroller} {onscroll} role="log" aria-live="polite" aria-relevant="additions">
    <div class="list" bind:this={list}>
      {#if chat.status === 'error'}
        <div class="empty">
          <p><strong>Chat isn't available</strong></p>
          <p class="u-text-muted">{chat.error}</p>
        </div>
      {:else if chat.status === 'loading' && !chat.messages.length}
        <div class="empty" aria-busy="true">
          <span class="p-icon--spinner u-animation--spin"></span>
        </div>
      {:else if !chat.messages.length}
        <div class="empty">
          <p><strong>No messages yet</strong></p>
          <p class="u-text-muted">Say hello to everyone watching {room.name}.</p>
        </div>
      {:else}
        {#if chat.canLoadMore}
          <div class="older">
            <button class="p-button--base is-dense" disabled={chat.loadingMore} onclick={loadOlder}>
              {chat.loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        {/if}
        {#each chat.messages as m, i (m.staged_id ?? m.id)}
          <ChatMessageItem
            message={m}
            me={me.username}
            grouped={grouped(m, chat.messages[i - 1])}
            mentionsMe={chat.mentionsMe(m)}
            active={activeId === m.id}
            onactivate={() => (activeId = activeId === m.id ? null : m.id)}
            onreact={(emoji) => {
              activeId = null
              ;(document.activeElement as HTMLElement | null)?.blur()
              void chat.toggleReaction(m, emoji)
            }}
            onretry={() => chat.retry(m)}
            ondiscard={() => chat.discard(m)}
          />
        {/each}
      {/if}
    </div>
  </div>

  {#if unseen > 0}
    <button class="jump" onclick={() => scrollToBottom()}>
      {unseen} new message{unseen === 1 ? '' : 's'} ↓
    </button>
  {/if}

  {#if chat.notice}
    <div class="notice" role="alert">{chat.notice}</div>
  {/if}

  <Composer
    placeholder={`Message #${chat.channel?.slug ?? room.slug}`}
    disabled={!chat.channel}
    channelId={chat.channel?.id}
    {recentUsers}
    {onsend}
  />
</section>

<style>
  .chat {
    --chat-gutter: 1rem;
    --chat-hover: rgb(0 0 0 / 0.035);
    --chat-chip: rgb(0 0 0 / 0.05);
    --chat-mention-bg: rgb(233 84 32 / 0.09);
    --chat-input-bg: var(--app-bg);
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--app-surface);
  }

  @media (prefers-color-scheme: dark) {
    .chat {
      --chat-hover: rgb(255 255 255 / 0.05);
      --chat-chip: rgb(255 255 255 / 0.08);
      --chat-mention-bg: rgb(233 84 32 / 0.16);
    }
  }

  .chat-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem var(--chat-gutter);
    border-bottom: 1px solid var(--app-border);
  }

  h2 {
    margin: 0;
    padding: 0;
    font-size: 1.05rem;
    font-weight: 550;
    line-height: 1.5;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    color: var(--app-text-muted);
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #0e8420;
  }

  [data-status='loading'] .dot,
  [data-status='polling'] .dot,
  [data-status='reconnecting'] .dot {
    background: #f99b11;
  }

  [data-status='error'] .dot {
    background: var(--yaru-red);
  }

  .scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 0 0.75rem;
  }

  .list {
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .empty {
    flex: 1;
    display: grid;
    place-content: center;
    justify-items: center;
    padding: 2rem 1rem;
    text-align: center;
  }

  .empty p {
    margin: 0;
    padding: 0;
  }

  .older {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0 0.5rem;
  }

  .older button {
    margin: 0;
  }

  .jump {
    position: absolute;
    left: 50%;
    bottom: 5rem;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    padding: 0.35rem 0.9rem;
    border: 0;
    border-radius: 999px;
    background: var(--yaru-aubergine-mid);
    color: #fff;
    font-size: 0.875rem;
    box-shadow: var(--app-shadow);
  }

  .notice {
    flex: none;
    padding: 0.4rem var(--chat-gutter);
    background: rgb(199 22 43 / 0.1);
    color: var(--yaru-red);
    font-size: 0.875rem;
  }
</style>
