import { session as electronSession, type Cookie } from 'electron'
import { partitionName } from '../../../shared/types'
import type { SessionStore } from '../config/store'

interface LegacyCookie {
  name?: string
  value?: string
  domain?: string
  path?: string
  expires?: number
  expirationDate?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: string
  session?: boolean
}

export function getPartition(sessionId: string) {
  return electronSession.fromPartition(partitionName(sessionId))
}

/** Import cookies.json from the Java client into an empty Electron partition. */
export async function importJavaCookiesIfNeeded(
  store: SessionStore,
  sessionId: string
): Promise<boolean> {
  const ses = getPartition(sessionId)
  const existing = await ses.cookies.get({ domain: 'x.com' })
  if (existing.length > 0) return false

  const legacy = store.readCookiesBackup(sessionId)
  if (!legacy || legacy.length === 0) return false

  let imported = 0
  for (const raw of legacy) {
    const c = raw as LegacyCookie
    if (!c.name || c.value === undefined) continue
    const domain = c.domain || '.x.com'
    const details: CookiesSetDetails = {
      url: urlForCookie(domain, c.path || '/'),
      name: c.name,
      value: String(c.value),
      domain,
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false
    }
    const exp = c.expirationDate ?? c.expires
    if (exp && exp > 0 && !c.session) {
      details.expirationDate = exp > 1e12 ? exp / 1000 : exp
    }
    if (c.sameSite) {
      details.sameSite = mapSameSite(c.sameSite)
    }
    try {
      await ses.cookies.set(details)
      imported++
    } catch (err) {
      console.warn('FluxDeck: cookie import failed', c.name, err)
    }
  }
  if (imported > 0) {
    console.log(`FluxDeck: importadas ${imported} cookies Java → partition ${sessionId}`)
  }
  return imported > 0
}

type CookiesSetDetails = Parameters<Electron.Cookies['set']>[0]

function urlForCookie(domain: string, path: string): string {
  const host = domain.startsWith('.') ? domain.slice(1) : domain
  return `https://${host}${path.startsWith('/') ? path : '/' + path}`
}

function mapSameSite(value: string): Cookie['sameSite'] {
  const v = value.toLowerCase()
  if (v === 'no_restriction' || v === 'none') return 'no_restriction'
  if (v === 'lax') return 'lax'
  if (v === 'strict') return 'strict'
  return 'unspecified'
}

export async function exportCookiesBackup(store: SessionStore, sessionId: string): Promise<void> {
  const ses = getPartition(sessionId)
  const cookies = await ses.cookies.get({})
  store.writeCookiesBackup(
    sessionId,
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expirationDate: c.expirationDate,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      session: c.session
    }))
  )
}
