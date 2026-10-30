<script lang="ts">
  import { onMount } from 'svelte'
  import AppHeader from './components/AppHeader.svelte'
  import UpdateToast from './components/UpdateToast.svelte'
  import Home from './views/Home.svelte'
  import Room from './views/Room.svelte'
  import SignIn from './views/SignIn.svelte'
  import { pwa } from './lib/pwa.svelte'
  import { router, href } from './lib/router.svelte'
  import { session } from './lib/session.svelte'

  onMount(async () => {
    pwa.init()
    await session.init()
    // completeSignIn() may have restored the pre-sign-in route.
    router.sync()
  })
</script>

<AppHeader />

<main class="app-main">
  {#if session.status === 'loading'}
    <div class="loading" aria-busy="true"><span class="p-icon--spinner u-animation--spin"></span></div>
  {:else if session.status === 'signed-out'}
    <SignIn />
  {:else if router.route.name === 'home'}
    <Home />
  {:else if router.route.name === 'room'}
    {#key router.route.slug}
      <Room slug={router.route.slug} />
    {/key}
  {:else}
    <div class="not-found">
      <h1 class="p-heading--4">Page not found</h1>
      <a href={href.home()}>Back to rooms</a>
    </div>
  {/if}
</main>

<UpdateToast />

<style>
  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .loading,
  .not-found {
    flex: 1;
    display: grid;
    place-content: center;
    justify-items: center;
    padding: 2rem;
  }
</style>
