// App-wide sign-in state.

import { beginSignIn, clearCredentials, completeSignIn, loadCredentials } from './discourse/auth'
import { discourse } from './discourse/client'
import type { CurrentUser } from './discourse/types'

type Status = 'loading' | 'signed-out' | 'signed-in'

class Session {
  status = $state<Status>('loading')
  user = $state<CurrentUser | null>(null)
  /** Last sign-in problem, shown on the sign-in screen. */
  error = $state<string | null>(null)
  busy = $state(false)

  constructor() {
    discourse.onAuthError(() => {
      this.reset('Your Discourse session has ended. Please sign in again.')
    })
  }

  async init() {
    const callback = await completeSignIn()
    if (callback.status === 'error') this.error = callback.message

    const credentials = callback.status === 'ok' ? callback.credentials : loadCredentials()
    if (!credentials) {
      this.status = 'signed-out'
      return
    }
    discourse.setCredentials(credentials)
    await this.refreshUser()
  }

  async refreshUser() {
    try {
      const { current_user } = await discourse.get<{ current_user: CurrentUser | null }>('/session/current.json')
      if (!current_user) return this.reset('Discourse did not recognise this device. Please sign in again.')
      this.user = current_user
      this.status = 'signed-in'
      this.error = null
    } catch (e) {
      // Keep the key on network errors so the app still works when Discourse blips.
      if (this.status !== 'signed-out') {
        this.error = e instanceof Error ? e.message : String(e)
        this.status = this.user ? 'signed-in' : 'signed-out'
      }
    }
  }

  async signIn() {
    this.busy = true
    this.error = null
    try {
      await beginSignIn()
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.busy = false
    }
  }

  async signOut() {
    this.busy = true
    try {
      await discourse.post('/user-api-key/revoke')
    } catch {
      // Revoking is best effort; forget the key locally regardless.
    }
    this.reset(null)
    this.busy = false
  }

  private reset(error: string | null) {
    clearCredentials()
    discourse.setCredentials(null)
    this.user = null
    this.status = 'signed-out'
    this.error = error
  }
}

export const session = new Session()
