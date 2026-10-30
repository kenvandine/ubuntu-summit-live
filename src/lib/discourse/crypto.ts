// RSA helpers for the Discourse User API Key handshake.
//
// The app generates a throwaway RSA key pair, sends Discourse the public key,
// and Discourse sends back the API key encrypted with it. We ask for OAEP
// padding (supported by current Discourse, SHA-1 per OpenSSL's default) so the
// browser's WebCrypto can decrypt natively. Older Discourse versions ignore the
// padding parameter and use PKCS#1 v1.5, which WebCrypto can't do, so we fall
// back to a small BigInt implementation for that case.

const OAEP = { name: 'RSA-OAEP', hash: 'SHA-1' } as const

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { ...OAEP, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportPublicKeyPem(key: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', key))
  const lines = bytesToBase64(spki).match(/.{1,64}/g) ?? []
  return ['-----BEGIN PUBLIC KEY-----', ...lines, '-----END PUBLIC KEY-----'].join('\n')
}

export async function exportPrivateJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key)
}

/** Decrypt a base64 payload from Discourse, trying OAEP first, then PKCS#1 v1.5. */
export async function decryptPayload(payloadB64: string, jwk: JsonWebKey): Promise<string> {
  const cipher = base64ToBytes(payloadB64.replace(/\s+/g, ''))
  try {
    const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RSA-OAEP' }, OAEP, false, ['decrypt'])
    const plain = await crypto.subtle.decrypt(OAEP, key, cipher as BufferSource)
    return new TextDecoder().decode(plain)
  } catch {
    return new TextDecoder().decode(decryptPkcs1v15(cipher, jwk))
  }
}

function decryptPkcs1v15(cipher: Uint8Array, jwk: JsonWebKey): Uint8Array {
  if (!jwk.n || !jwk.d) throw new Error('Private key is missing')
  const n = bytesToBigInt(base64UrlToBytes(jwk.n))
  const d = bytesToBigInt(base64UrlToBytes(jwk.d))
  const k = base64UrlToBytes(jwk.n).length
  const em = bigIntToBytes(modPow(bytesToBigInt(cipher), d, n), k)
  // EM = 0x00 || 0x02 || PS (non-zero, >= 8 bytes) || 0x00 || M
  if (em[0] !== 0 || em[1] !== 2) throw new Error('Could not decrypt sign-in payload')
  const sep = em.indexOf(0, 2)
  if (sep < 10) throw new Error('Could not decrypt sign-in payload')
  return em.slice(sep + 1)
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base %= mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    base = (base * base) % mod
    exp >>= 1n
  }
  return result
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex ? BigInt('0x' + hex) : 0n
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const hex = value.toString(16).padStart(length * 2, '0')
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return base64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
}
