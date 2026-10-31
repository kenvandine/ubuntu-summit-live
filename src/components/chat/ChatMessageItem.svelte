<script lang="ts">
  import { config } from '../../lib/config'
  import type { ChatMessage } from '../../lib/discourse/chat'
  import { emojiImageUrl, escapeText, nativeEmoji, prepareCooked, QUICK_REACTIONS } from '../../lib/discourse/cooked'
  import { avatarUrl } from '../../lib/discourse/types'

  let {
    message,
    me,
    grouped,
    mentionsMe,
    active,
    onactivate,
    onreact,
    onretry,
    ondiscard,
  }: {
    message: ChatMessage
    me: string
    /** Continues the previous message from the same person, so skip the header. */
    grouped: boolean
    mentionsMe: boolean
    active: boolean
    onactivate: () => void
    onreact: (emoji: string) => void
    onretry: () => void
    ondiscard: () => void
  } = $props()

  const html = $derived(message.cooked ? prepareCooked(message.cooked, me) : escapeText(message.message))
  const mine = $derived(message.user.username === me)
  const displayName = $derived(message.user.name || message.user.username)
  const time = $derived(
    new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  )

  function onclick(e: MouseEvent) {
    // Tapping a message (not a link or button in it) shows its reaction bar on touch screens.
    if (!(e.target as HTMLElement).closest('a, button')) onactivate()
  }
</script>

{#snippet emoji(name: string)}
  {@const native = nativeEmoji(name)}
  {#if native}<span class="emoji" aria-hidden="true">{native}</span>{:else}<img
      class="emoji"
      src={emojiImageUrl(name)}
      alt=""
      width="18"
      height="18"
    />{/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
  class="msg"
  class:grouped
  class:mention={mentionsMe && !mine}
  class:pending={message.pending}
  class:failed={message.failed}
  class:active
  {onclick}
  aria-label={`${displayName} at ${time}`}
>
  {#if !grouped}
    <img class="avatar" src={avatarUrl(config.discourseUrl, message.user, 72)} alt="" width="36" height="36" />
    <header>
      <span class="name" class:mine>{displayName}</span>
      <time datetime={message.created_at}>{time}</time>
    </header>
  {/if}

  <div class="body">
    {@html html}
    {#if message.edited}<span class="edited">(edited)</span>{/if}
  </div>

  {#if message.failed}
    <div class="failed-row">
      <span>Not sent.</span>
      <button class="link" onclick={onretry}>Retry</button>
      <button class="link" onclick={ondiscard}>Discard</button>
    </div>
  {/if}

  {#if message.reactions.length}
    <div class="reactions">
      {#each message.reactions as r (r.emoji)}
        <button
          class="reaction"
          class:reacted={r.reacted}
          aria-pressed={r.reacted}
          aria-label={`${r.emoji} reaction, ${r.count}. ${r.reacted ? 'Remove yours' : 'Add yours'}`}
          title={r.users?.map((u) => u.username).join(', ') || `:${r.emoji}:`}
          onclick={() => onreact(r.emoji)}
        >
          {@render emoji(r.emoji)}<span class="count">{r.count}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if message.id > 0}
    <div class="react-bar" role="toolbar" aria-label="React">
      {#each QUICK_REACTIONS as name (name)}
        <button aria-label={`React with ${name}`} title={`:${name}:`} onclick={() => onreact(name)}>
          {@render emoji(name)}
        </button>
      {/each}
    </div>
  {/if}
</article>

<style>
  .msg {
    position: relative;
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr);
    column-gap: 0.75rem;
    padding: 0.4rem var(--chat-gutter) 0.15rem;
    margin-top: 0.5rem;
    border-left: 3px solid transparent;
  }

  .msg.grouped {
    margin-top: 0;
    padding-top: 0.1rem;
  }

  .msg > :not(.avatar, .react-bar) {
    grid-column: 2;
  }

  .msg:hover,
  .msg.active {
    background: var(--chat-hover);
  }

  .msg.mention {
    background: var(--chat-mention-bg);
    border-left-color: var(--yaru-orange);
  }

  .msg.pending .body {
    opacity: 0.55;
  }

  .avatar {
    grid-row: span 3;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--app-border);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    line-height: 1.3;
  }

  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name.mine {
    color: var(--yaru-orange);
  }

  time,
  .edited {
    font-size: 0.8rem;
    color: var(--app-text-muted);
  }

  .body {
    overflow-wrap: anywhere;
    line-height: 1.45;
  }

  .body :global(p) {
    margin: 0;
    padding: 0;
    max-width: none;
  }

  .body :global(p + p) {
    margin-top: 0.4rem;
  }

  .body :global(img:not(.emoji)) {
    max-width: min(100%, 20rem);
    max-height: 14rem;
    height: auto;
    border-radius: 0.4rem;
  }

  .body :global(img.emoji) {
    width: 1.25em;
    height: 1.25em;
    vertical-align: text-bottom;
  }

  .body :global(.mention) {
    padding: 0 0.2rem;
    border-radius: 0.25rem;
    background: var(--chat-chip);
    color: inherit;
    font-weight: 550;
    text-decoration: none;
  }

  .body :global(.mention.is-me) {
    background: var(--yaru-orange);
    color: #fff;
  }

  .body :global(pre),
  .body :global(code) {
    font-size: 0.85em;
  }

  .body :global(pre) {
    margin: 0.3rem 0;
    padding: 0.5rem;
    max-height: 12rem;
    overflow: auto;
  }

  .body :global(blockquote) {
    margin: 0.3rem 0;
    padding: 0 0 0 0.75rem;
    border-left: 3px solid var(--app-border);
  }

  .failed-row {
    display: flex;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: var(--yaru-red);
  }

  .link {
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    text-decoration: underline;
    font-size: inherit;
  }

  .reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.3rem;
  }

  .reaction {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0;
    padding: 0.1rem 0.55rem;
    min-height: 1.75rem;
    border: 1px solid var(--app-border);
    border-radius: 999px;
    background: var(--chat-chip);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .reaction.reacted {
    border-color: var(--yaru-orange);
    background: var(--chat-mention-bg);
  }

  .count {
    font-variant-numeric: tabular-nums;
  }

  .emoji {
    font-size: 1.05rem;
    line-height: 1;
  }

  img.emoji {
    width: 1.1rem;
    height: 1.1rem;
  }

  .react-bar {
    position: absolute;
    top: -1.1rem;
    right: var(--chat-gutter);
    z-index: 2;
    display: none;
    gap: 0.1rem;
    padding: 0.2rem;
    border: 1px solid var(--app-border);
    border-radius: 999px;
    background: var(--app-surface-raised);
    box-shadow: var(--app-shadow);
  }

  .msg:first-child .react-bar {
    top: 0.2rem;
  }

  .react-bar button {
    margin: 0;
    padding: 0.2rem 0.35rem;
    border: 0;
    border-radius: 999px;
    background: none;
    line-height: 1;
  }

  .react-bar button:hover,
  .react-bar button:focus-visible {
    background: var(--chat-hover);
  }

  .msg.active .react-bar,
  .msg:focus-within .react-bar {
    display: flex;
  }

  @media (hover: hover) {
    .msg:hover .react-bar {
      display: flex;
    }
  }
</style>
