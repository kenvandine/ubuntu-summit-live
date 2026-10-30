// Discourse User API Key sign-in.
// Docs: https://meta.discourse.org/t/user-api-keys-specification/48536
//
// 1. beginSignIn() makes a key pair + nonce, stashes the private key, and sends
//    the browser to /user-api-key/new on Discourse.
// 2. The user approves; Discourse redirects back to the app root with
//    ?payload=<base64 RSA-encrypted JSON {key, nonce, push, api}>.
// 3. completeSignIn() decrypts it, checks the nonce, and stores the key.

import { config, appRootUrl } from '../config'
import { decryptPayload, exportPrivateJwk, exportPublicKeyPem, generateKeyPair, randomHex } from './crypto'
import type { Credentials } from './client'

const STORAGE = {
  clientId: 'summit.discourse.clientId',
  credentials: 'summit.discourse.credentials',
  pending: 'summit.discourse.pendingAuth',
}

/** How long a started sign-in stays valid. */
const PENDING_TTL_MS = 30 * 60 * 1000

interface PendingAuth {
  nonce: string
  jwk: JsonWebKey
  createdAt: number
  /** Hash route to return to after sign-in. */
  returnTo: string
}

interface DecryptedPayload {
  key: string
  nonce: string
  push?: boolean
  api?: number
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Stable per-install id. Discourse replaces the old key when the same client re-authorizes. */
export function clientId(): string {
  let id = localStorage.getItem(STORAGE.clientId)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE.clientId, id)
  }
  return id
}

export function loadCredentials(): Credentials | null {
  const creds = readJson<Credentials>(STORAGE.credentials)
  return creds?.key && creds.clientId ? creds : null
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE.credentials)
}

export async function beginSignIn(returnTo = window.location.hash): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair()
  const nonce = randomHex(16)
  const pending: PendingAuth = { nonce, jwk: await exportPrivateJwk(privateKey), createdAt: Date.now(), returnTo }
  localStorage.setItem(STORAGE.pending, JSON.stringify(pending))

  const params = new URLSearchParams({
    application_name: config.applicationName,
    client_id: clientId(),
    scopes: config.scopes.join(','),
    public_key: await exportPublicKeyPem(publicKey),
    nonce,
    auth_redirect: appRootUrl(),
    padding: 'oaep',
  })
  window.location.assign(`${config.discourseUrl}/user-api-key/new?${params}`)
}

export type CallbackResult =
  | { status: 'none' }
  | { status: 'ok'; credentials: Credentials; returnTo: string }
  | { status: 'error'; message: string }

/** If the current URL is a Discourse sign-in callback, finish signing in. */
export async function completeSignIn(): Promise<CallbackResult> {
  const url = new URL(window.location.href)
  const payload = url.searchParams.get('payload')
  if (!payload) return { status: 'none' }

  const pending = readJson<PendingAuth>(STORAGE.pending)
  localStorage.removeItem(STORAGE.pending)

  // Drop ?payload from the address bar (and history) whatever happens next.
  url.searchParams.delete('payload')
  url.searchParams.delete('oneTimePassword')
  const returnTo = pending?.returnTo || '#/'
  history.replaceState(null, '', `${url.pathname}${url.search}${returnTo}`)

  if (!pending || Date.now() - pending.createdAt > PENDING_TTL_MS) {
    return { status: 'error', message: 'That sign-in link has expired. Please sign in again.' }
  }

  try {
    const data = JSON.parse(await decryptPayload(payload, pending.jwk)) as DecryptedPayload
    if (data.nonce !== pending.nonce) throw new Error('Sign-in response did not match this request.')
    if (!data.key) throw new Error('Discourse did not return an API key.')
    const credentials: Credentials = { key: data.key, clientId: clientId() }
    localStorage.setItem(STORAGE.credentials, JSON.stringify(credentials))
    return { status: 'ok', credentials, returnTo }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Sign-in failed.' }
  }
}
