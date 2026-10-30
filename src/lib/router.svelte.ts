// Minimal hash router. Hash routes keep deep links working on GitHub Pages,
// which has no SPA fallback, and leave the query string free for the
// Discourse sign-in callback.

export type Route = { name: 'home' } | { name: 'room'; slug: string } | { name: 'not-found'; path: string }

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'home' }
  if (parts[0] === 'room' && parts[1]) return { name: 'room', slug: decodeURIComponent(parts[1]) }
  return { name: 'not-found', path }
}

class Router {
  route = $state<Route>(parse(window.location.hash))

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = parse(window.location.hash)
    })
  }

  sync() {
    this.route = parse(window.location.hash)
  }
}

export const router = new Router()

export const href = {
  home: () => '#/',
  room: (slug: string) => `#/room/${encodeURIComponent(slug)}`,
}
