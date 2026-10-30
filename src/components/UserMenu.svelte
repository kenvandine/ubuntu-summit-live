<script lang="ts">
  import { config } from '../lib/config'
  import { session } from '../lib/session.svelte'
  import { avatarUrl, type CurrentUser } from '../lib/discourse/types'

  let { user }: { user: CurrentUser } = $props()
  let open = $state(false)
  let root: HTMLElement

  function onWindowClick(e: MouseEvent) {
    if (open && !root.contains(e.target as Node)) open = false
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="user-menu" bind:this={root}>
  <button
    class="avatar-button"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={`Account menu for ${user.username}`}
    onclick={() => (open = !open)}
  >
    <img src={avatarUrl(config.discourseUrl, user, 64)} alt="" width="32" height="32" />
  </button>

  {#if open}
    <div class="menu" role="menu">
      <div class="who">
        <strong>{user.name || user.username}</strong>
        <span class="u-text-muted">@{user.username}</span>
      </div>
      <a role="menuitem" href={`${config.discourseUrl}/u/${user.username}`} target="_blank" rel="noopener">
        Discourse profile
      </a>
      <button role="menuitem" class="p-button--base" disabled={session.busy} onclick={() => session.signOut()}>
        Sign out
      </button>
    </div>
  {/if}
</div>

<style>
  .user-menu {
    position: relative;
  }

  .avatar-button {
    margin: 0;
    padding: 0;
    width: 2.25rem;
    height: 2.25rem;
    min-height: 0;
    border: 2px solid rgb(255 255 255 / 0.5);
    border-radius: 50%;
    overflow: hidden;
    background: transparent;
  }

  .avatar-button:hover,
  .avatar-button[aria-expanded='true'] {
    border-color: var(--yaru-orange);
    background: transparent;
  }

  .avatar-button img {
    display: block;
    width: 100%;
    height: 100%;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.5rem);
    min-width: 14rem;
    padding: 0.5rem;
    border-radius: var(--app-radius);
    background: var(--app-surface-raised);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow);
    display: flex;
    flex-direction: column;
  }

  .who {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.75rem 0.75rem;
    border-bottom: 1px solid var(--app-border);
    margin-bottom: 0.5rem;
  }

  .menu a,
  .menu button {
    margin: 0;
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-radius: 0.375rem;
  }

  .menu a:hover {
    background: var(--app-border);
    text-decoration: none;
  }
</style>
