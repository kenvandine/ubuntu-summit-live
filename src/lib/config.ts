// Build-time configuration. Override with VITE_* variables (see .env.example).

const trimSlash = (url: string) => url.replace(/\/+$/, '')

export const config = {
  /** Discourse instance the app talks to and signs in against. */
  discourseUrl: trimSlash(import.meta.env.VITE_DISCOURSE_URL || 'https://discourse.staging.ubuntu.com'),
  /** Shown to users on Discourse's "authorize application" screen. */
  applicationName: import.meta.env.VITE_APP_NAME || 'Ubuntu Summit Live',
  /**
   * User API key scopes requested at sign-in.
   * - read / write: browse and post (chat messages come in a later step)
   * - session_info: look up who just signed in
   * - message_bus: live updates for chat
   */
  scopes: ['read', 'write', 'session_info', 'message_bus'],
}

/** Absolute URL of the app root; Discourse redirects here after sign-in. */
export const appRootUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString()
