<script lang="ts">
  import Logo from './Logo.svelte'
  import UserMenu from './UserMenu.svelte'
  import { session } from '../lib/session.svelte'
  import { pwa } from '../lib/pwa.svelte'
  import { href } from '../lib/router.svelte'
</script>

<header class="app-header">
  <a class="brand" href={href.home()}>
    <Logo size={28} />
    <span class="brand-name">Ubuntu Summit</span>
    <span class="live-pill"><span class="dot"></span>Live</span>
  </a>

  <div class="actions">
    {#if pwa.canInstall}
      <button class="install p-button--base is-dense" onclick={() => pwa.install()}>Install app</button>
    {/if}
    {#if session.status === 'signed-in' && session.user}
      <UserMenu user={session.user} />
    {/if}
  </div>
</header>

<style>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    height: calc(var(--header-height) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
    background: linear-gradient(90deg, var(--yaru-aubergine), var(--yaru-aubergine-mid));
    color: #fff;
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.06), 0 4px 16px rgb(0 0 0 / 0.2);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: inherit;
    text-decoration: none;
    font-weight: 550;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.05rem 0.55rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.12);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--yaru-orange);
    box-shadow: 0 0 0 0 rgb(233 84 32 / 0.6);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    70% {
      box-shadow: 0 0 0 0.45rem rgb(233 84 32 / 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgb(233 84 32 / 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .install {
    margin: 0;
    color: #fff;
    border-color: rgb(255 255 255 / 0.35);
    background: transparent;
  }

  .install:hover {
    background: rgb(255 255 255 / 0.1);
  }

  @media (max-width: 30rem) {
    .brand-name {
      display: none;
    }
  }
</style>
