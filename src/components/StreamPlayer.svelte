<script lang="ts">
  // YouTube live stream for a room, or a holding card until one is set in rooms.json.
  import { youtubeEmbedUrl, type Room } from '../lib/rooms'

  let { room }: { room: Room } = $props()
  const embed = $derived(youtubeEmbedUrl(room.stream))
</script>

<div class="player">
  {#if embed}
    <iframe
      src={embed}
      title={`${room.name} live stream`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  {:else}
    <div class="holding">
      <span class="badge">Off air</span>
      <p class="eyebrow">Ubuntu Summit</p>
      <p class="title">{room.name}</p>
      <p class="hint">The stream will appear here when the talk starts.</p>
    </div>
  {/if}
</div>

<style>
  .player {
    position: relative;
    aspect-ratio: 16 / 9;
    width: 100%;
    overflow: hidden;
    background: #000;
  }

  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .holding {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 1.25rem 1.5rem;
    color: #fff;
    background:
      radial-gradient(circle at 85% 15%, rgb(233 84 32 / 0.45), transparent 55%),
      linear-gradient(135deg, var(--yaru-aubergine), var(--yaru-aubergine-mid));
  }

  .holding p {
    margin: 0;
    padding: 0;
    max-width: none;
  }

  .badge {
    position: absolute;
    top: 0.9rem;
    left: 0.9rem;
    padding: 0.15rem 0.55rem;
    border-radius: 0.3rem;
    background: rgb(0 0 0 / 0.35);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .title {
    font-size: clamp(1.4rem, 4vw, 2.2rem);
    font-weight: 300;
    line-height: 1.2;
  }

  .hint {
    margin-top: 0.4rem !important;
    font-size: 0.9rem;
    opacity: 0.75;
  }
</style>
