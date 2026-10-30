# Ubuntu Summit Live

An installable web app for following Ubuntu Summit talks: live chat per room, backed by the
Ubuntu Discourse and its Chat plugin, with the talk's video stream alongside.

Built with Vite, TypeScript and Svelte 5, styled with Canonical's
[Vanilla framework](https://vanillaframework.io) and the Yaru palette, and deployed to GitHub Pages.

**Status:** sign-in and app shell are done. Room chat (Discourse Chat) and video are next.

## Sign-in

Users sign in with their Discourse account through
[User API Keys](https://meta.discourse.org/t/user-api-keys-specification/48536). No server is needed:

1. The app makes a throwaway RSA key pair and sends the user to `/user-api-key/new` on Discourse.
2. The user approves, and Discourse redirects back to the app with the API key encrypted to that key pair.
3. The app decrypts it in the browser, keeps it in `localStorage`, and sends it as the `User-Api-Key`
   header on every API call. Signing out revokes the key on Discourse.

### Discourse admin settings

On the Discourse instance (`/admin/site_settings`):

| Setting | Value |
| --- | --- |
| `allowed_user_api_auth_redirects` | add `https://kenvandine.github.io/ubuntu-summit-live/*` (and `http://localhost:5173/*` for local dev) |
| `cors_origins` | add `https://kenvandine.github.io` (and `http://localhost:5173`) |
| `allow_user_api_key_scopes` | must include `read`, `write`, `session_info`, `message_bus` (all are on by default) |
| `user_api_key_allowed_groups` | groups allowed to sign in; the default already includes trust level 0 |

CORS also has to be switched on for the whole server, which is not a site setting: add
`DISCOURSE_ENABLE_CORS: true` to the `env:` section of `containers/app.yml` and rebuild
(`./launcher rebuild app`). Without it Discourse ignores `cors_origins`.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/ubuntu-summit-live/
npm run check    # type check
npm run build    # production build in dist/
```

Configuration lives in environment variables (see `.env.example`):

- `VITE_DISCOURSE_URL`: the Discourse instance (default `https://discourse.staging.ubuntu.com`).
  In CI it comes from the `DISCOURSE_URL` repository variable if set.
- `BASE_PATH`: the path the app is served from (default `/ubuntu-summit-live/`).

## Rooms

Rooms are listed in [`public/rooms.json`](public/rooms.json), so organisers can change them without
touching code. Each room will map to a Discourse category, a Chat channel and a stream:

```json
{ "slug": "main-stage", "name": "Main stage", "categoryId": 12, "chatChannelId": 3, "stream": { "kind": "youtube", "url": "…" } }
```

## Layout

```
src/
  lib/
    config.ts            build-time settings
    discourse/           API client, User API Key sign-in, types
    session.svelte.ts    signed-in state
    router.svelte.ts     hash router (#/, #/room/:slug)
    rooms.ts             room model, loads rooms.json
    pwa.svelte.ts        service worker updates and install prompt
  components/            header, user menu, update toast
  views/                 sign-in, room list, room (stream + chat slots)
```

## Deployment

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.
In the repository's Settings → Pages, the source must be **GitHub Actions**.
