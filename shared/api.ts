import type { ColumnConfig, SessionRecord } from './types'

export interface AppInfo {
  name: string
  version: string
  author: string
  authorUrl: string
}

export interface AppState {
  columnWidth: number
  sessions: SessionRecord[]
  columns: ColumnConfig[]
  hasLoggedIn: boolean
}

export interface PostMediaItem {
  kind: 'image' | 'video'
  url: string
  label: string
}

export type { ColumnConfig, SessionRecord }
