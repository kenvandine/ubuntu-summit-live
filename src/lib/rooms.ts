// Summit rooms. Each room maps to a Discourse category and its Chat channel,
// and (later) a video stream. Organisers edit public/rooms.json; no rebuild needed.

export interface RoomStream {
  /** e.g. "youtube" | "hls" | "peertube"; decided in the video step. */
  kind: string
  url: string
}

export interface Room {
  slug: string
  name: string
  description?: string
  /** Discourse category this room's talks live in. */
  categoryId?: number
  /** Discourse Chat channel used for live chat. Filled in by the chat step. */
  chatChannelId?: number
  stream?: RoomStream
}

export async function loadRooms(): Promise<Room[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}rooms.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Could not load rooms (${res.status})`)
  const data = (await res.json()) as { rooms: Room[] }
  return data.rooms
}
