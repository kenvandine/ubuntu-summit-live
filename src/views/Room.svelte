<script lang="ts">
  // Room: YouTube stream plus live chat.
  // Phones get an edge-to-edge layout (stream full width on top, chat filling
  // the rest, message box pinned to the bottom). Wider screens put the stream
  // and chat side by side.
  import { onMount } from 'svelte'
  import ChatPanel from '../components/chat/ChatPanel.svelte'
  import StreamPlayer from '../components/StreamPlayer.svelte'
  import { loadRooms } from '../lib/rooms'
  import { href } from '../lib/router.svelte'
  import { session } from '../lib/session.svelte'

  let { slug }: { slug: string } = $props()
  const room = $derived(loadRooms().then((rooms) => rooms.find((r) => r.slug === slug)))

  // On phones the on-screen keyboard shrinks the visual viewport but not 100dvh
  // (notably on iOS), which would push the message box under the keyboard.
  // Track the visible height so the layout always ends just above it.
  onMount(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--visible-height', `${vv.height}px`)
      if (vv.offsetTop > 0 && document.activeElement?.tagName === 'TEXTAREA') window.scrollTo(0, 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--visible-height')
    }
  })
</script>

{#await room then r}
  {#if r}
    <div class="room">
      <div class="title-bar">
        <a href={href.home()} class="back" aria-label="Back to rooms">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
          </svg>
        </a>
        <h1>{r.name}</h1>
        {#if r.description}<span class="description u-text-muted">{r.description}</span>{/if}
      </div>
      <section class="stage" aria-label="Video stream">
        <StreamPlayer room={r} />
      </section>
      {#if session.user}
        <ChatPanel room={r} me={session.user} />
      {/if}
    </div>
  {:else}
    <div class="missing">
      <p>There's no room called “{slug}”.</p>
      <a href={href.home()}>Back to rooms</a>
    </div>
  {/if}
{/await}

<style>
  /* Phones: edge to edge, the whole room fits the visible screen. */
  .room {
    display: flex;
    flex-direction: column;
    height: calc(var(--visible-height, 100dvh) - var(--header-height) - env(safe-area-inset-top));
    overflow: hidden;
  }

  .room :global(.chat) {
    flex: 1;
    --composer-bottom-inset: env(safe-area-inset-bottom);
  }

  .title-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0 max(0.5rem, env(safe-area-inset-right)) 0 max(0.5rem, env(safe-area-inset-left));
    background: var(--app-surface);
    border-bottom: 1px solid var(--app-border);
  }

  .back {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    color: inherit;
  }

  .back:hover {
    background: var(--app-border);
  }

  h1 {
    margin: 0;
    padding: 0;
    font-size: 1.15rem;
    font-weight: 400;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .description {
    display: none;
  }

  .stage {
    flex: none;
  }

  /* Phones held sideways: stream and chat side by side, no room for a title bar. */
  @media (orientation: landscape) and (max-height: 32rem) {
    .room {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 38%);
      grid-template-rows: auto minmax(0, 1fr);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }

    .title-bar {
      grid-column: 1;
    }

    .stage {
      grid-column: 1;
      align-self: center;
    }

    .room :global(.chat) {
      grid-column: 2;
      grid-row: 1 / span 2;
      border-left: 1px solid var(--app-border);
    }
  }

  /* Laptops and desktops: padded, side by side, chat as a card. */
  @media (min-width: 62rem) {
    .room {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 25rem;
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas: 'title chat' 'stage chat';
      gap: 1rem 1.25rem;
      width: 100%;
      max-width: 100rem;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 1.5rem;
      height: calc(100dvh - var(--header-height) - env(safe-area-inset-top));
    }

    .title-bar {
      grid-area: title;
      padding: 0;
      min-height: 0;
      background: none;
      border: 0;
      gap: 0.75rem;
    }

    h1 {
      font-size: 1.6rem;
      font-weight: 300;
    }

    .description {
      display: inline;
    }

    .stage {
      grid-area: stage;
      align-self: start;
    }

    .stage :global(.player) {
      /* Keep the whole 16:9 frame on screen on short, wide displays. */
      max-width: calc((100dvh - var(--header-height) - 7rem) * 16 / 9);
      border-radius: var(--app-radius);
      box-shadow: var(--app-shadow);
    }

    .room :global(.chat) {
      grid-area: chat;
      border: 1px solid var(--app-border);
      border-radius: var(--app-radius);
      box-shadow: var(--app-shadow);
      overflow: hidden;
      --composer-bottom-inset: 0px;
    }
  }

  .missing {
    padding: 3rem 1rem;
    text-align: center;
  }
</style>
