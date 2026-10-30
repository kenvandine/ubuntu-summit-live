<script lang="ts">
  // Room layout: stream on top/left, chat alongside. The video player and
  // Discourse Chat integration are later steps; this view reserves their slots.
  import { loadRooms } from '../lib/rooms'
  import { href } from '../lib/router.svelte'

  let { slug }: { slug: string } = $props()
  const room = $derived(loadRooms().then((rooms) => rooms.find((r) => r.slug === slug)))
</script>

{#await room then r}
  {#if r}
    <div class="room">
      <div class="title-bar">
        <a href={href.home()} class="back">← Rooms</a>
        <h1 class="p-heading--4">{r.name}</h1>
      </div>
      <section class="stage" aria-label="Video stream">
        <div class="placeholder">
          <span class="u-text-muted">The stream will appear here</span>
        </div>
      </section>
      <section class="chat" aria-label="Live chat">
        <header class="chat-header">Live chat</header>
        <div class="chat-body u-text-muted">Chat for this room is coming in the next update.</div>
      </section>
    </div>
  {:else}
    <div class="missing">
      <p>There's no room called “{slug}”.</p>
      <a href={href.home()}>Back to rooms</a>
    </div>
  {/if}
{/await}

<style>
  .room {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
    grid-template-areas: 'title' 'stage' 'chat';
    gap: 1rem;
    width: 100%;
    max-width: 96rem;
    margin: 0 auto;
    padding: 1rem;
    min-height: 0;
  }

  @media (min-width: 62rem) {
    .room {
      grid-template-columns: minmax(0, 1fr) 24rem;
      grid-template-rows: auto 1fr;
      grid-template-areas: 'title title' 'stage chat';
      height: calc(100dvh - var(--header-height) - env(safe-area-inset-top));
    }
  }

  .title-bar {
    grid-area: title;
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .title-bar h1 {
    margin: 0;
    padding: 0;
  }

  .stage {
    grid-area: stage;
  }

  .placeholder {
    aspect-ratio: 16 / 9;
    display: grid;
    place-items: center;
    border-radius: var(--app-radius);
    background: linear-gradient(135deg, var(--yaru-aubergine), var(--yaru-aubergine-mid));
  }

  .placeholder span {
    color: rgb(255 255 255 / 0.7);
  }

  .chat {
    grid-area: chat;
    display: flex;
    flex-direction: column;
    min-height: 20rem;
    border-radius: var(--app-radius);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow);
    overflow: hidden;
  }

  .chat-header {
    padding: 0.75rem 1rem;
    font-weight: 550;
    border-bottom: 1px solid var(--app-border);
  }

  .chat-body {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 1rem;
    text-align: center;
  }

  .missing {
    padding: 3rem 1rem;
    text-align: center;
  }
</style>
