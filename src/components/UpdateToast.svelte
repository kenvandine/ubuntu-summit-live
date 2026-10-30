<script lang="ts">
  import { pwa } from '../lib/pwa.svelte'
</script>

{#if pwa.needRefresh}
  <div class="toast" role="status">
    <span>A new version of Summit Live is ready.</span>
    <div class="actions">
      <button class="dismiss is-dense" onclick={() => pwa.dismiss()}>Later</button>
      <button class="app-button-brand is-dense" onclick={() => pwa.update()}>Reload</button>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: max(1rem, env(safe-area-inset-bottom));
    translate: -50% 0;
    z-index: 20;
    width: min(calc(100% - 2rem), 32rem);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
    border-radius: var(--app-radius);
    background: var(--yaru-aubergine);
    color: #fff;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .actions button {
    margin: 0;
  }

  .dismiss {
    background: transparent;
    color: #fff;
    border-color: rgb(255 255 255 / 0.35);
  }

  .dismiss:hover {
    background: rgb(255 255 255 / 0.1);
  }
</style>
