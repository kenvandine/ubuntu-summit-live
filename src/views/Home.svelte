<script lang="ts">
  import { loadRooms } from '../lib/rooms'
  import { href } from '../lib/router.svelte'
  import { session } from '../lib/session.svelte'

  const rooms = loadRooms()
  const firstName = $derived((session.user?.name || session.user?.username || '').split(' ')[0])
</script>

<div class="page">
  <header class="intro">
    <h1 class="p-heading--3">Welcome{firstName ? `, ${firstName}` : ''}</h1>
    <p class="u-text-muted">Pick a room to follow the talk and join the chat.</p>
  </header>

  {#await rooms}
    <p class="u-text-muted">Loading rooms…</p>
  {:then list}
    <ul class="rooms">
      {#each list as room (room.slug)}
        <li>
          <a class="room" href={href.room(room.slug)}>
            <span class="room-name">{room.name}</span>
            {#if room.description}<span class="u-text-muted">{room.description}</span>{/if}
            <span class="go" aria-hidden="true">→</span>
          </a>
        </li>
      {/each}
    </ul>
  {:catch err}
    <div class="p-notification--negative">
      <div class="p-notification__content">
        <p class="p-notification__message">{err.message}</p>
      </div>
    </div>
  {/await}
</div>

<style>
  .page {
    width: min(100%, 64rem);
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }

  .rooms {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  }

  .rooms li {
    margin: 0;
    padding: 0;
  }

  .room {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    height: 100%;
    padding: 1.25rem 2.75rem 1.25rem 1.25rem;
    border-radius: var(--app-radius);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-top: 3px solid var(--yaru-orange);
    box-shadow: var(--app-shadow);
    color: inherit;
    text-decoration: none;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .room:hover {
    transform: translateY(-2px);
    text-decoration: none;
  }

  .room-name {
    font-weight: 550;
    font-size: 1.125rem;
  }

  .go {
    position: absolute;
    right: 1.25rem;
    top: 50%;
    translate: 0 -50%;
    color: var(--yaru-orange);
    font-size: 1.25rem;
  }
</style>
