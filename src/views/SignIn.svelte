<script lang="ts">
  import Logo from '../components/Logo.svelte'
  import { config } from '../lib/config'
  import { session } from '../lib/session.svelte'

  const host = new URL(config.discourseUrl).host
</script>

<section class="hero">
  <div class="card">
    <Logo size={64} />
    <h1 class="p-heading--2">Join the conversation</h1>
    <p class="lead">
      Chat live with everyone watching Ubuntu Summit talks, room by room, on any device.
    </p>

    {#if session.error}
      <div class="p-notification--negative">
        <div class="p-notification__content">
          <p class="p-notification__message">{session.error}</p>
        </div>
      </div>
    {/if}

    <button class="app-button-brand sign-in" disabled={session.busy} onclick={() => session.signIn()}>
      {session.busy ? 'Redirecting…' : 'Sign in with Ubuntu Discourse'}
    </button>

    <p class="fine-print u-text-muted">
      You'll be asked on <strong>{host}</strong> to let this app read and post on your behalf. You can revoke
      access any time from your Discourse profile.
    </p>
  </div>
</section>

<style>
  .hero {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
    background:
      radial-gradient(60rem 30rem at 85% -10%, rgb(233 84 32 / 0.35), transparent 60%),
      radial-gradient(50rem 30rem at -10% 110%, rgb(119 33 111 / 0.55), transparent 60%),
      var(--yaru-aubergine);
  }

  .card {
    width: min(100%, 28rem);
    padding: 2.5rem 2rem 2rem;
    border-radius: 1.25rem;
    background: var(--app-surface);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.35);
    text-align: center;
  }

  h1 {
    margin-top: 1.25rem;
    padding-top: 0;
  }

  .lead {
    color: var(--app-text-muted);
  }

  .sign-in {
    width: 100%;
    margin-top: 0.5rem;
    font-weight: 550;
  }

  .fine-print {
    margin-top: 1rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .p-notification--negative {
    text-align: left;
  }
</style>
