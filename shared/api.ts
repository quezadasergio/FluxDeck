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

export type { ColumnConfig, SessionRecord }
