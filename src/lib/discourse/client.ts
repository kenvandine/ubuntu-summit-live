// Thin fetch wrapper for the Discourse API, authenticated with a User API Key.
// Later steps (rooms, chat, message bus) build on `discourse.get/post`.

import { config } from '../config'

export interface Credentials {
  key: string
  clientId: string
}

export class DiscourseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403
  }
}

type Listener = (err: DiscourseError) => void

export class DiscourseClient {
  private credentials: Credentials | null = null
  private authErrorListeners = new Set<Listener>()

  constructor(readonly baseUrl: string) {}

  setCredentials(credentials: Credentials | null) {
    this.credentials = credentials
  }

  /** Called when Discourse rejects our key (revoked, expired, user suspended...). */
  onAuthError(listener: Listener) {
    this.authErrorListeners.add(listener)
    return () => this.authErrorListeners.delete(listener)
  }

  url(path: string) {
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (this.credentials) {
      headers.set('User-Api-Key', this.credentials.key)
      headers.set('User-Api-Client-Id', this.credentials.clientId)
    }
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    let res: Response
    try {
      res = await fetch(this.url(path), { ...init, headers, credentials: 'omit' })
    } catch {
      // A CORS rejection surfaces as a network error with no status.
      throw new DiscourseError(`Could not reach ${this.baseUrl}. Is CORS enabled for this site?`, 0)
    }

    if (!res.ok) {
      const err = new DiscourseError(await errorMessage(res), res.status)
      if (err.isAuthError && this.credentials) this.authErrorListeners.forEach((l) => l(err))
      throw err
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  get<T>(path: string) {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  }
}

async function errorMessage(res: Response) {
  try {
    const data = await res.json()
    if (Array.isArray(data.errors) && data.errors.length) return data.errors.join(' ')
    if (data.error) return String(data.error)
  } catch {
    // not JSON
  }
  return `${res.status} ${res.statusText}`.trim()
}

export const discourse = new DiscourseClient(config.discourseUrl)
