// A small fake Discourse for local development and demos, covering what the app
// uses: User API Key sign-in, /session/current, Chat channels and messages,
// reactions, user search and MessageBus long polling. Simulated attendees chat
// in every room so there is always something happening.
//
//   npm run mock        # this server on http://localhost:4200
//   npm run dev:mock    # the app, pointed at it
//
// Options: PORT=4200, QUIET=1 (no simulated chatter), POLL_ONLY=1 (MessageBus
// returns 404, to exercise the app's polling fallback).

import { createServer } from 'node:http'
import { constants, publicEncrypt, randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT || 4200)
const QUIET = !!process.env.QUIET
const POLL_ONLY = !!process.env.POLL_ONLY

const COLORS = ['c7162b', '5e2750', 'b35900', '0e8420', '335280', 'e95420', '77216f', '00838f']

const users = [
  ['kenvandine', 'Ken VanDine'],
  ['jonas', 'Jonas Weber'],
  ['sofia', 'Sofia Lindqvist'],
  ['liwei', 'Li Wei'],
  ['amara', 'Amara Okafor'],
  ['diego', 'Diego Martín'],
  ['priya', 'Priya Raman'],
  ['oliver', 'Oliver Grawert'],
].map(([username, name], i) => ({
  id: i + 1,
  username,
  name,
  avatar_template: `/letter_avatar/${username}/{size}.svg`,
  admin: i === 0,
  moderator: i === 0,
  trust_level: 2,
}))
const byUsername = new Map(users.map((u) => [u.username, u]))

const channels = [
  { id: 1, slug: 'main-stage', title: 'Main stage', chatable_id: 10, members: 342 },
  { id: 2, slug: 'room-2', title: 'Room 2', chatable_id: 11, members: 118 },
  { id: 3, slug: 'workshops', title: 'Workshops', chatable_id: 12, members: 57 },
]

const SCRIPT = [
  'Hello from Berlin! 👋',
  'Audio is great today',
  'Greetings from the Riga watch party 👋🇱🇻',
  'Will the slides be posted on Discourse afterwards?',
  'Yes, they go in the talk topic in this category',
  'Is TPM-backed FDE going to be the default?',
  'That demo was smooth',
  'Snap refresh awareness is a game changer 🚀',
  'Can you share the link to the repo?',
  'The new installer looks so clean',
  '+1 to that question',
  'Watching from Lagos, hi everyone!',
  'Is there a recording for people in other time zones?',
  'Great question @sofia',
  "What's the plan for GNOME 51 on the LTS?",
  'Love the Yaru refresh',
]
const REACTIONS = ['+1', 'heart', 'tada', 'clap', 'rocket', 'laughing', 'wave']

let nextMessageId = 1
let nextBusId = 1
const messages = new Map(channels.map((c) => [c.id, []]))
/** MessageBus backlog per bus channel: [{ id, data }] */
const backlog = new Map()
const waiters = new Set()
/** api key -> username */
const keys = new Map()

// --- seed history -----------------------------------------------------------

for (const c of channels) {
  const start = Date.now() - 40 * 60 * 1000
  for (let i = 0; i < 24; i++) {
    const user = users[1 + ((i * 3 + c.id) % (users.length - 1))]
    const m = makeMessage(c.id, user, SCRIPT[(i + c.id) % SCRIPT.length], new Date(start + i * 95_000))
    if (i % 5 === 2) m.reactions.push({ emoji: REACTIONS[i % REACTIONS.length], count: 1 + (i % 9), users: [] })
    messages.get(c.id).push(m)
  }
}

function makeMessage(channelId, user, text, at = new Date()) {
  return {
    id: nextMessageId++,
    chat_channel_id: channelId,
    message: text,
    cooked: cook(text),
    created_at: at.toISOString(),
    user: publicUser(user),
    reactions: [],
    edited: false,
  }
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, avatar_template: u.avatar_template }
}

function cook(text) {
  const esc = text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
  const linked = esc
    .replace(/(^|\s)@([\w.-]+)/g, (all, pre, name) =>
      byUsername.has(name.toLowerCase()) ? `${pre}<a class="mention" href="/u/${name}">@${name}</a>` : all,
    )
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
  return linked
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// --- message bus ------------------------------------------------------------

function publish(channel, data) {
  const list = backlog.get(channel) ?? []
  list.push({ id: nextBusId++, data })
  backlog.set(channel, list.slice(-200))
  for (const w of [...waiters]) w.check()
}

function busLastId(channel) {
  return backlog.get(channel)?.at(-1)?.id ?? 0
}

function pending(subs) {
  const out = []
  const status = {}
  for (const [channel, last] of Object.entries(subs)) {
    const lastId = Number(last)
    if (lastId < 0) {
      status[channel] = busLastId(channel)
      continue
    }
    for (const m of backlog.get(channel) ?? []) {
      if (m.id > lastId) out.push({ global_id: m.id, message_id: m.id, channel, data: m.data })
    }
  }
  if (Object.keys(status).length) out.push({ global_id: -1, message_id: -1, channel: '/__status', data: status })
  return out
}

// --- simulated attendees ----------------------------------------------------

if (!QUIET) {
  setInterval(() => {
    const c = channels[Math.floor(Math.random() * channels.length)]
    const list = messages.get(c.id)
    if (Math.random() < 0.35 && list.length) {
      const target = list[Math.max(0, list.length - 1 - Math.floor(Math.random() * 4))]
      const user = users[1 + Math.floor(Math.random() * (users.length - 1))]
      addReaction(c.id, target, REACTIONS[Math.floor(Math.random() * REACTIONS.length)], user, 'add')
    } else {
      const user = users[1 + Math.floor(Math.random() * (users.length - 1))]
      const m = makeMessage(c.id, user, SCRIPT[Math.floor(Math.random() * SCRIPT.length)])
      list.push(m)
      publish(`/chat/${c.id}`, { type: 'sent', chat_message: m })
    }
  }, 2500)
}

function addReaction(channelId, message, emoji, user, action) {
  let r = message.reactions.find((x) => x.emoji === emoji)
  const has = r?.users.some((u) => u.id === user.id)
  if (action === 'add') {
    if (has) return
    if (!r) message.reactions.push((r = { emoji, count: 0, users: [] }))
    r.count++
    r.users.push({ id: user.id, username: user.username })
  } else {
    if (!r || !has) return
    r.count--
    r.users = r.users.filter((u) => u.id !== user.id)
    if (r.count <= 0) message.reactions = message.reactions.filter((x) => x !== r)
  }
  publish(`/chat/${channelId}`, {
    type: 'reaction',
    action,
    emoji,
    chat_message_id: message.id,
    user: publicUser(user),
  })
}

// --- http -------------------------------------------------------------------

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '600',
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { ...cors, 'Content-Type': type })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  if (!raw) return {}
  if ((req.headers['content-type'] || '').includes('json')) return JSON.parse(raw)
  return Object.fromEntries(new URLSearchParams(raw))
}

function currentUser(req) {
  const name = keys.get(req.headers['user-api-key'])
  return name ? byUsername.get(name) : null
}

function serializeChannel(c, me) {
  const busId = busLastId(`/chat/${c.id}`)
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    chatable_id: c.chatable_id,
    chatable_type: 'Category',
    memberships_count: c.members,
    current_user_membership: { following: !!me && (c.followers ??= new Set()).has(me.id) },
    meta: { message_bus_last_ids: { channel_message_bus_last_id: busId } },
  }
}

function withReacted(m, me) {
  return { ...m, reactions: m.reactions.map((r) => ({ ...r, reacted: !!me && r.users.some((u) => u.id === me.id) })) }
}

const routes = [
  ['GET', /^\/user-api-key\/new$/, (req, res, _m, url) => send(res, 200, authorizePage(url), 'text/html')],
  ['GET', /^\/user-api-key\/approve$/, approve],
  ['POST', /^\/user-api-key\/revoke$/, (req, res) => {
    keys.delete(req.headers['user-api-key'])
    send(res, 200, { success: 'OK' })
  }],
  ['GET', /^\/session\/current$/, (req, res) => {
    const me = currentUser(req)
    me ? send(res, 200, { current_user: me }) : send(res, 404, { error: 'not logged in' })
  }],
  ['GET', /^\/letter_avatar\/([\w.-]+)\/(\d+)\.svg$/, (req, res, m) => send(res, 200, letterAvatar(m[1], m[2]), 'image/svg+xml')],
  ['GET', /^\/chat\/api\/channels$/, auth((req, res, _m, _url, me) => send(res, 200, { channels: channels.map((c) => serializeChannel(c, me)) }))],
  ['GET', /^\/chat\/api\/channels\/(\d+)$/, auth((req, res, m, _url, me) => {
    const c = channels.find((x) => x.id === Number(m[1]))
    c ? send(res, 200, { channel: serializeChannel(c, me) }) : send(res, 404, { errors: ['Not found'] })
  })],
  ['GET', /^\/chat\/api\/channels\/(\d+)\/messages$/, auth((req, res, m, url, me) => {
    const list = messages.get(Number(m[1]))
    if (!list) return send(res, 404, { errors: ['Not found'] })
    const size = Math.min(Number(url.searchParams.get('page_size') || 50), 100)
    const target = Number(url.searchParams.get('target_message_id') || 0)
    const older = target ? list.filter((x) => x.id < target) : list
    const page = older.slice(-size)
    send(res, 200, {
      messages: page.map((x) => withReacted(x, me)),
      meta: { can_load_more_past: older.length > page.length },
    })
  })],
  ['POST', /^\/chat\/api\/channels\/(\d+)\/memberships\/me$/, auth((req, res, m, _url, me) => {
    const c = channels.find((x) => x.id === Number(m[1]))
    ;(c.followers ??= new Set()).add(me.id)
    send(res, 200, { membership: { following: true } })
  })],
  ['POST', /^\/chat\/(\d+)$/, auth(async (req, res, m, _url, me) => {
    const id = Number(m[1])
    const body = await readBody(req)
    if (!body.message?.trim()) return send(res, 422, { errors: ['Message is empty'] })
    const msg = makeMessage(id, me, body.message.trim())
    messages.get(id).push(msg)
    publish(`/chat/${id}`, { type: 'sent', chat_message: msg, staged_id: body.staged_id })
    send(res, 200, { success: 'OK', message_id: msg.id })
  })],
  ['PUT', /^\/chat\/(\d+)\/react\/(\d+)$/, auth(async (req, res, m, _url, me) => {
    const body = await readBody(req)
    const msg = messages.get(Number(m[1]))?.find((x) => x.id === Number(m[2]))
    if (!msg) return send(res, 404, { errors: ['Not found'] })
    addReaction(Number(m[1]), msg, body.emoji, me, body.react_action === 'remove' ? 'remove' : 'add')
    send(res, 200, { success: 'OK' })
  })],
  ['GET', /^\/u\/search\/users$/, auth((req, res, _m, url) => {
    const term = (url.searchParams.get('term') || '').toLowerCase()
    const found = users.filter((u) => u.username.startsWith(term) || u.name.toLowerCase().includes(term))
    send(res, 200, { users: found.slice(0, Number(url.searchParams.get('limit') || 6)).map(publicUser) })
  })],
  ['POST', /^\/message-bus\/([\w-]+)\/poll$/, auth(async (req, res) => {
    if (POLL_ONLY) return send(res, 404, { errors: ['Not found'] })
    const subs = await readBody(req)
    const now = pending(subs)
    if (now.length) return send(res, 200, now)
    const waiter = {
      check() {
        const out = pending(subs)
        if (out.length) finish(out)
      },
    }
    const finish = (out) => {
      waiters.delete(waiter)
      clearTimeout(timer)
      if (!res.writableEnded) send(res, 200, out)
    }
    const timer = setTimeout(() => finish([]), 25_000)
    waiters.add(waiter)
    req.on('close', () => {
      waiters.delete(waiter)
      clearTimeout(timer)
    })
  })],
]

function auth(handler) {
  return (req, res, m, url) => {
    const me = currentUser(req)
    if (!me) return send(res, 403, { errors: ['You are not permitted to view the requested resource.'], error_type: 'invalid_access' })
    return handler(req, res, m, url, me)
  }
}

function authorizePage(url) {
  const q = url.searchParams
  const options = users
    .map((u) => `<button name="username" value="${u.username}">${u.name} <small>@${u.username}</small></button>`)
    .join('')
  const hidden = [...q].map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, '&quot;')}">`).join('')
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Mock Discourse</title>
<style>body{font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem}button{display:block;width:100%;margin:.4rem 0;padding:.7rem;font-size:1rem;text-align:left;border:1px solid #ccc;border-radius:.4rem;background:#fff;cursor:pointer}button:hover{border-color:#e95420}small{color:#777}</style>
<h1>Mock Discourse</h1><p><b>${q.get('application_name') || 'An app'}</b> wants to access your account (${q.get('scopes')}).</p>
<p>Sign in as:</p><form action="/user-api-key/approve">${hidden}${options}</form>`
}

function approve(req, res, _m, url) {
  const q = url.searchParams
  const user = byUsername.get(q.get('username'))
  if (!user) return send(res, 400, 'Unknown user', 'text/plain')
  const key = randomUUID().replace(/-/g, '')
  keys.set(key, user.username)
  const payload = Buffer.from(JSON.stringify({ key, nonce: q.get('nonce'), push: false, api: 4 }))
  const oaep = q.get('padding') === 'oaep'
  const encrypted = publicEncrypt(
    {
      key: q.get('public_key'),
      padding: oaep ? constants.RSA_PKCS1_OAEP_PADDING : constants.RSA_PKCS1_PADDING,
      oaepHash: 'sha1',
    },
    payload,
  ).toString('base64')
  const target = new URL(q.get('auth_redirect'))
  target.searchParams.set('payload', encrypted)
  res.writeHead(302, { Location: target.toString() })
  res.end()
}

function letterAvatar(username, size) {
  const color = COLORS[[...username].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#${color}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Ubuntu, system-ui, sans-serif" font-size="50" fill="#fff">${username[0].toUpperCase()}</text></svg>`
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }
  const path = url.pathname.replace(/\.json$/, '')
  for (const [method, pattern, handler] of routes) {
    const m = req.method === method && path.match(pattern)
    if (m) {
      try {
        return await handler(req, res, m, url)
      } catch (e) {
        console.error(e)
        return send(res, 500, { errors: [String(e)] })
      }
    }
  }
  send(res, 404, { errors: ['Not found'] })
}).listen(PORT, () => {
  console.log(`Mock Discourse on http://localhost:${PORT}${QUIET ? ' (quiet)' : ''}${POLL_ONLY ? ' (no MessageBus)' : ''}`)
})
