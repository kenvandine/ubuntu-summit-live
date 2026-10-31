<script lang="ts">
  import { config } from '../../lib/config'
  import { searchUsers, type ChatUser } from '../../lib/discourse/chat'
  import { avatarUrl } from '../../lib/discourse/types'

  let {
    placeholder,
    disabled = false,
    channelId,
    /** People already in the conversation, suggested first for @mentions. */
    recentUsers,
    onsend,
  }: {
    placeholder: string
    disabled?: boolean
    channelId?: number
    recentUsers: ChatUser[]
    onsend: (text: string) => void
  } = $props()

  let text = $state('')
  let input: HTMLTextAreaElement
  let suggestions = $state<ChatUser[]>([])
  let selected = $state(0)
  /** The "@partial" being typed, with where it starts. */
  let mention = $state<{ start: number; term: string } | null>(null)
  let searchTimer: ReturnType<typeof setTimeout>
  let searchSeq = 0

  function submit() {
    if (!text.trim() || disabled) return
    onsend(text)
    text = ''
    closeMentions()
    queueMicrotask(resize)
    input.focus()
  }

  function resize() {
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`
  }

  function onkeydown(e: KeyboardEvent) {
    if (suggestions.length && mention) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        selected = (selected + step + suggestions.length) % suggestions.length
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pick(suggestions[selected])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMentions()
        return
      }
    }
    // Enter sends; Shift+Enter adds a line. Leave Enter alone while an IME is composing.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  function oninput() {
    resize()
    const before = text.slice(0, input.selectionStart ?? text.length)
    const m = before.match(/(^|\s)@([\w.-]{0,20})$/)
    if (!m) return closeMentions()
    mention = { start: before.length - m[2].length - 1, term: m[2] }
    lookup(m[2])
  }

  function lookup(term: string) {
    const t = term.toLowerCase()
    const local = recentUsers
      .filter((u) => u.username.toLowerCase().startsWith(t) || u.name?.toLowerCase().includes(t))
      .slice(0, 6)
    suggestions = local
    selected = 0
    clearTimeout(searchTimer)
    if (!term) return
    const seq = ++searchSeq
    searchTimer = setTimeout(async () => {
      try {
        const remote = await searchUsers(term, channelId)
        if (seq !== searchSeq || !mention) return
        const seen = new Set(local.map((u) => u.username))
        suggestions = [...local, ...remote.filter((u) => !seen.has(u.username))].slice(0, 6)
      } catch {
        // Local suggestions are fine on their own.
      }
    }, 150)
  }

  function pick(user: ChatUser) {
    if (!mention) return
    const end = mention.start + 1 + mention.term.length
    const insert = `@${user.username} `
    text = text.slice(0, mention.start) + insert + text.slice(end)
    const caret = mention.start + insert.length
    closeMentions()
    queueMicrotask(() => {
      input.focus()
      input.setSelectionRange(caret, caret)
    })
  }

  function closeMentions() {
    mention = null
    suggestions = []
    searchSeq++
    clearTimeout(searchTimer)
  }
</script>

<form
  class="composer"
  onsubmit={(e) => {
    e.preventDefault()
    submit()
  }}
>
  {#if mention && suggestions.length}
    <ul class="mentions" role="listbox" aria-label="Mention someone">
      {#each suggestions as user, i (user.username)}
        <li role="option" aria-selected={i === selected}>
          <button
            type="button"
            class:selected={i === selected}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pick(user)}
          >
            <img src={avatarUrl(config.discourseUrl, user, 48)} alt="" width="24" height="24" />
            <span class="username">@{user.username}</span>
            {#if user.name}<span class="u-text-muted">{user.name}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <textarea
    bind:this={input}
    bind:value={text}
    {placeholder}
    {disabled}
    rows="1"
    enterkeyhint="send"
    aria-label={placeholder}
    {onkeydown}
    {oninput}
    onblur={() => setTimeout(closeMentions, 100)}
  ></textarea>
  <button class="send" type="submit" disabled={disabled || !text.trim()} aria-label="Send message">
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
    </svg>
  </button>
</form>

<style>
  .composer {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.6rem var(--chat-gutter) calc(0.6rem + var(--composer-bottom-inset, 0px));
    border-top: 1px solid var(--app-border);
    background: var(--app-surface);
  }

  textarea {
    flex: 1;
    margin: 0;
    min-height: 2.75rem;
    max-height: 8rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--app-border);
    border-radius: 1.375rem;
    background: var(--chat-input-bg);
    color: inherit;
    resize: none;
    line-height: 1.45;
    /* 16px stops iOS zooming into the field on focus. */
    font-size: 1rem;
    box-shadow: none;
  }

  textarea:focus {
    outline: 2px solid var(--yaru-orange);
    outline-offset: -1px;
    border-color: transparent;
  }

  .send {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--yaru-orange);
    color: #fff;
    transition: transform 0.1s;
  }

  .send:hover:not(:disabled) {
    background: var(--yaru-orange-strong);
  }

  .send:active:not(:disabled) {
    transform: scale(0.94);
  }

  .send:disabled {
    opacity: 0.45;
  }

  .mentions {
    position: absolute;
    left: var(--chat-gutter);
    right: var(--chat-gutter);
    bottom: calc(100% + 0.25rem);
    z-index: 5;
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    border: 1px solid var(--app-border);
    border-radius: 0.6rem;
    background: var(--app-surface-raised);
    box-shadow: var(--app-shadow);
  }

  .mentions li {
    margin: 0;
    padding: 0;
  }

  .mentions button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    margin: 0;
    padding: 0.4rem 0.5rem;
    border: 0;
    border-radius: 0.4rem;
    background: none;
    color: inherit;
    text-align: left;
  }

  .mentions button.selected,
  .mentions button:hover {
    background: var(--chat-hover);
  }

  .mentions img {
    border-radius: 50%;
  }

  .username {
    font-weight: 600;
  }
</style>
