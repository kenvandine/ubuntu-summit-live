// Discourse Chat plugin API.
// Routes live in plugins/chat/config/routes.rb in the Discourse repo. We use the
// stable /chat/api/* endpoints where they exist and the long-standing /chat/:id
// endpoints for sending and reacting, which every supported version has.

import { discourse, DiscourseError } from './client'
import type { Room } from '../rooms'

export interface ChatUser {
  id: number
  username: string
  name?: string | null
  avatar_template: string
}

export interface ChatReaction {
  emoji: string
  count: number
  /** Whether the current user is one of the reactors. */
  reacted: boolean
  users?: Pick<ChatUser, 'id' | 'username'>[]
}

export interface ChatMessage {
  id: number
  message: string
  cooked: string
  created_at: string
  user: ChatUser
  reactions: ChatReaction[]
  deleted_at?: string | null
  edited?: boolean
  in_reply_to?: { id: number; excerpt?: string; user?: ChatUser } | null
  /** Set by us while a message we sent is on its way. */
  staged_id?: string
  pending?: boolean
  failed?: boolean
}

export interface ChatChannel {
  id: number
  title: string
  slug?: string
  description?: string | null
  chatable_id?: number
  chatable_type?: string
  memberships_count?: number
  current_user_membership?: { following?: boolean } | null
  meta?: { message_bus_last_ids?: { channel_message_bus_last_id?: number } }
}

interface MessagesResponse {
  messages: ChatMessage[]
  meta?: { can_load_more_past?: boolean; channel_message_bus_last_id?: number }
}

/** Find the chat channel for a room: explicit id, then its category, then a matching slug. */
export async function resolveChannel(room: Room): Promise<ChatChannel> {
  if (room.chatChannelId) return getChannel(room.chatChannelId)

  const { channels } = await discourse.get<{ channels: ChatChannel[] }>('/chat/api/channels?limit=100')
  const match =
    channels.find((c) => room.categoryId && c.chatable_type === 'Category' && c.chatable_id === room.categoryId) ??
    channels.find((c) => c.slug === room.slug)
  if (!match) {
    throw new DiscourseError(
      `No chat channel found for “${room.name}”. Set chatChannelId or categoryId for it in rooms.json.`,
      404,
    )
  }
  // The list serializer is lighter than the show one; fetch the full channel for message bus ids.
  return getChannel(match.id)
}

export async function getChannel(id: number) {
  const { channel } = await discourse.get<{ channel: ChatChannel }>(`/chat/api/channels/${id}`)
  return channel
}

export async function fetchMessages(channelId: number, opts: { before?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({ page_size: String(opts.pageSize ?? 50) })
  if (opts.before) {
    params.set('target_message_id', String(opts.before))
    params.set('direction', 'past')
  }
  const res = await discourse.get<MessagesResponse>(`/chat/api/channels/${channelId}/messages?${params}`)
  return {
    messages: res.messages.map(normalise),
    canLoadMore: !!res.meta?.can_load_more_past,
  }
}

/** Follow the channel so we can post in it. Older Discourse versions use the follow route. */
export async function joinChannel(channelId: number) {
  try {
    await discourse.post(`/chat/api/channels/${channelId}/memberships/me`)
  } catch (e) {
    if (e instanceof DiscourseError && e.status === 404) {
      await discourse.post(`/chat/chat_channels/${channelId}/follow`)
    } else {
      throw e
    }
  }
}

export async function sendMessage(channelId: number, message: string, stagedId: string) {
  return discourse.post<{ message_id?: number }>(`/chat/${channelId}`, { message, staged_id: stagedId })
}

export async function react(channelId: number, messageId: number, emoji: string, action: 'add' | 'remove') {
  await discourse.put(`/chat/${channelId}/react/${messageId}`, { emoji, react_action: action })
}

export async function searchUsers(term: string, channelId?: number) {
  const params = new URLSearchParams({ term, include_groups: 'false', limit: '6' })
  if (channelId) params.set('chat_channel_id', String(channelId))
  const { users } = await discourse.get<{ users: ChatUser[] }>(`/u/search/users.json?${params}`)
  return users
}

/** Fill in fields older Discourse versions leave out. */
export function normalise(m: ChatMessage): ChatMessage {
  return { ...m, reactions: (m.reactions ?? []).map((r) => ({ ...r, reacted: !!r.reacted })) }
}
