export interface CurrentUser {
  id: number
  username: string
  name: string | null
  avatar_template: string
  admin: boolean
  moderator: boolean
  trust_level: number
}

export const avatarUrl = (baseUrl: string, user: Pick<CurrentUser, 'avatar_template'>, size = 96) => {
  const path = user.avatar_template.replace('{size}', String(size))
  return path.startsWith('http') ? path : `${baseUrl}${path}`
}
