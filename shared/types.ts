export type ColumnType =
  | 'forYou'
  | 'following'
  | 'notifications'
  | 'profile'
  | 'custom'

export interface SessionRecord {
  id: string
  username: string
}

export interface ColumnConfig {
  type: ColumnType
  sessionId: string
  url?: string | null
}

export interface AppConfigData {
  $schema?: string
  columnWidth: number
  sessions: SessionRecord[]
  columns: ColumnConfig[]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ColumnLayoutSlot {
  index: number
  bounds: Rect
}

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  forYou: 'For You',
  following: 'Following',
  notifications: 'Notifications',
  profile: 'Profile',
  custom: 'Custom'
}

export const DEFAULT_COLUMN_WIDTH = 420
export const TWEET_LIMIT = 280

export function columnUrl(
  type: ColumnType,
  username: string | undefined,
  customUrl?: string | null
): string {
  switch (type) {
    case 'forYou':
    case 'following':
      return 'https://x.com/home'
    case 'notifications':
      return 'https://x.com/notifications'
    case 'profile':
      return `https://x.com/${username ?? ''}`
    case 'custom':
      return customUrl || 'https://x.com/home'
  }
}

export function partitionName(sessionId: string): string {
  return `persist:fluxdeck-${sessionId}`
}
