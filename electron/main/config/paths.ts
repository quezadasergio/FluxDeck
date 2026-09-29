import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { AppConfigData } from '../../../shared/types'
import { DEFAULT_COLUMN_WIDTH } from '../../../shared/types'

const DEFAULT_SETTINGS: AppConfigData = {
  $schema: './schema.json',
  columnWidth: DEFAULT_COLUMN_WIDTH,
  sessions: [],
  columns: []
}

const SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "$schema": { "type": "string" },
    "columnWidth": { "type": "integer", "minimum": 280 },
    "sessions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "username": { "type": "string" }
        },
        "required": ["id", "username"],
        "additionalProperties": false
      }
    },
    "columns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["forYou", "following", "notifications", "profile", "custom"]
          },
          "sessionId": { "type": "string" },
          "url": { "type": "string" }
        },
        "required": ["type", "sessionId"],
        "additionalProperties": false
      }
    }
  },
  "required": ["sessions", "columns"]
}
`

export function configDir(): string {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA
    if (appdata) return join(appdata, 'FluxDeck')
    return join(homedir(), 'AppData', 'Roaming', 'FluxDeck')
  }
  return join(homedir(), '.config', 'FluxDeck')
}

export function settingsFile(): string {
  return join(configDir(), 'settings.json')
}

export function schemaFile(): string {
  return join(configDir(), 'schema.json')
}

export function sessionDir(sessionId: string): string {
  return join(configDir(), 'sessions', sessionId)
}

export function cookiesFile(sessionId: string): string {
  return join(sessionDir(sessionId), 'cookies.json')
}

function ensureFiles(): void {
  mkdirSync(configDir(), { recursive: true })
  if (!existsSync(settingsFile())) {
    writeFileSync(settingsFile(), JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n', 'utf8')
  }
  writeFileSync(schemaFile(), SCHEMA, 'utf8')
}

export function loadConfig(): AppConfigData {
  ensureFiles()
  try {
    const raw = readFileSync(settingsFile(), 'utf8')
    const data = JSON.parse(raw) as AppConfigData
    return {
      $schema: data.$schema ?? './schema.json',
      columnWidth: data.columnWidth > 0 ? data.columnWidth : DEFAULT_COLUMN_WIDTH,
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      columns: Array.isArray(data.columns) ? data.columns : []
    }
  } catch {
    return { ...DEFAULT_SETTINGS, sessions: [], columns: [] }
  }
}

export function saveConfig(config: AppConfigData): void {
  ensureFiles()
  const out: AppConfigData = {
    $schema: config.$schema ?? './schema.json',
    columnWidth: config.columnWidth > 0 ? config.columnWidth : DEFAULT_COLUMN_WIDTH,
    sessions: config.sessions ?? [],
    columns: config.columns ?? []
  }
  writeFileSync(settingsFile(), JSON.stringify(out, null, 2) + '\n', 'utf8')
}

/** Copy bundled defaults from resources when packaging (no-op if missing). */
export function copyBundledSchemaIfNeeded(): void {
  try {
    const bundled = join(app.getAppPath(), 'resources', 'schema.json')
    if (existsSync(bundled)) {
      cpSync(bundled, schemaFile())
    }
  } catch {
    // ignore
  }
}
