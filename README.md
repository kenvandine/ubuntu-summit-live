# Ubuntu Summit Live

An installable web app for following Ubuntu Summit talks: live chat per room, backed by the
Ubuntu Discourse and its Chat plugin, with the talk's video stream alongside.

Built with Vite, TypeScript and Svelte 5, styled with Canonical's
[Vanilla framework](https://vanillaframework.io) and the Yaru palette, and deployed to GitHub Pages.

**Status:** sign-in, rooms, live chat and YouTube streams are in. Polish and launch are next.

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

Chat needs the Chat plugin enabled (`chat_enabled`), and each room's channel must be readable by the
people who will sign in.

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

### Without a Discourse

`mock/discourse.mjs` is a small fake Discourse with everything the app uses: sign-in, chat channels,
messages, reactions, user search and MessageBus, plus simulated attendees chatting in every room.

```sh
npm run mock       # fake Discourse on http://localhost:4200
npm run dev:mock   # the app, pointed at it
```

`QUIET=1 npm run mock` turns off the simulated chatter, and `POLL_ONLY=1 npm run mock` turns off the
MessageBus so you can see the polling fallback.

Configuration lives in environment variables (see `.env.example`):

- `VITE_DISCOURSE_URL`: the Discourse instance (default `https://discourse.staging.ubuntu.com`).
  In CI it comes from the `DISCOURSE_URL` repository variable if set.
- `BASE_PATH`: the path the app is served from (default `/ubuntu-summit-live/`).

## Rooms

Rooms are listed in [`public/rooms.json`](public/rooms.json), so organisers can change them without
touching code or rebuilding. Each room maps to a Discourse Chat channel and a YouTube stream:

```json
{
  "slug": "main-stage",
  "name": "Main stage",
  "description": "Keynotes and headline talks",
  "categoryId": 12,
  "chatChannelId": 3,
  "stream": { "kind": "youtube", "url": "https://www.youtube.com/live/VIDEO_ID" }
}
```

- **Chat channel:** `chatChannelId` if set; otherwise the chat channel of category `categoryId`;
  otherwise a channel whose slug matches the room's `slug`. The channel id is in the channel's URL
  on Discourse (`/chat/c/main-stage/3`).
- **Stream:** `url` can be a YouTube watch, `/live/`, `youtu.be` or embed link, or a bare video id.
  A channel id (`UC…`) or `/channel/UC…` link follows whatever that channel is streaming live, which
  saves editing the file between talks. Without a stream the room shows an "off air" card.

## Chat

Each room shows the latest 50 messages from its channel, with earlier ones loaded as you scroll up.
New messages, reactions, edits and deletions arrive over Discourse's MessageBus (long polling on
`/message-bus/…/poll`). If the MessageBus can't connect, for example because the server's CORS setup
doesn't allow the `User-Api-Key` header there, the app falls back to refetching the latest messages
every 5 seconds and shows "Live (slow updates)" in the chat header.

Messages appear as soon as you send them and are confirmed when Discourse echoes them back. Type `@`
to mention someone (people in the conversation first, then a Discourse user search). Hover a message,
or tap it on a phone, for quick reactions; tap an existing reaction to add or remove yours.

On phones the room is edge to edge: the stream runs full width at the top, chat fills the rest of the
screen, and the message box stays pinned above the keyboard. Phones held sideways and wider screens
put the stream and chat side by side.

## Layout

```
src/
  lib/
    config.ts            build-time settings
    discourse/           API client, User API Key sign-in, Chat API, MessageBus, types
    chat.svelte.ts       live chat state for a room
    session.svelte.ts    signed-in state
    router.svelte.ts     hash router (#/, #/room/:slug)
    rooms.ts             room model, loads rooms.json, YouTube embed URLs
    pwa.svelte.ts        service worker updates and install prompt
  components/            header, user menu, update toast, stream player
    chat/                chat panel, message, composer
  views/                 sign-in, room list, room
mock/discourse.mjs       fake Discourse for local development
```

## Deployment

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.
In the repository's Settings → Pages, the source must be **GitHub Actions**.
