// Summit rooms. Each room maps to a Discourse category, its Chat channel and a
// YouTube stream. Organisers edit public/rooms.json; no rebuild needed.

export interface RoomStream {
  /** Only "youtube" for now (the default). */
  kind?: 'youtube'
  /** A watch/live/youtu.be/embed URL, a bare video id, or a channel id (UC…) to follow its live stream. */
  url: string
}

export interface Room {
  slug: string
  name: string
  description?: string
  /** Discourse category this room's talks live in. */
  categoryId?: number
  /**
   * Discourse Chat channel used for live chat. If left out, the app uses the
   * channel for categoryId, then a channel whose slug matches the room's.
   */
  chatChannelId?: number
  stream?: RoomStream
}

export async function loadRooms(): Promise<Room[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}rooms.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Could not load rooms (${res.status})`)
  const data = (await res.json()) as { rooms: Room[] }
  return data.rooms
}

/** YouTube embed URL for a stream, or null if it isn't one we understand. */
export function youtubeEmbedUrl(stream: RoomStream | undefined): string | null {
  if (!stream?.url || (stream.kind && stream.kind !== 'youtube')) return null
  const params = new URLSearchParams({ autoplay: '1', mute: '1', playsinline: '1', rel: '0', modestbranding: '1' })
  const raw = stream.url.trim()

  const channel = raw.match(/^(UC[\w-]{22})$/)?.[1] ?? raw.match(/\/channel\/(UC[\w-]{22})/)?.[1]
  if (channel) {
    params.set('channel', channel)
    return `https://www.youtube.com/embed/live_stream?${params}`
  }

  let id: string | null = /^[\w-]{11}$/.test(raw) ? raw : null
  if (!id) {
    try {
      const url = new URL(raw)
      id =
        url.hostname === 'youtu.be'
          ? url.pathname.slice(1)
          : (url.searchParams.get('v') ?? url.pathname.match(/\/(?:live|embed|shorts)\/([\w-]{11})/)?.[1] ?? null)
    } catch {
      return null
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?${params}` : null
}
