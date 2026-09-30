import { dialog, net } from 'electron'
import { createWriteStream } from 'fs'
import { basename } from 'path'

export interface PostMediaItem {
  kind: 'image' | 'video'
  url: string
  label: string
}

interface Variant {
  bitrate?: number
  content_type?: string
  url?: string
}

interface MediaDetail {
  type?: string
  media_url_https?: string
  video_info?: { variants?: Variant[] }
}

const MAX_BYTES = 250 * 1024 * 1024

export function statusIdFromLink(input: string): string | null {
  const text = input.trim()
  const match =
    text.match(/(?:x\.com|twitter\.com)\/(?:i\/status|[^/?#]+\/status)\/(\d+)/i) ||
    text.match(/status\/(\d+)/i)
  return match?.[1] ?? null
}

function bestMp4(variants: Variant[] | undefined): string | null {
  const mp4s = (variants ?? []).filter(
    (variant) =>
      (variant.content_type ?? '').includes('mp4') &&
      variant.url &&
      !variant.url.includes('.m3u8')
  )
  mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
  return mp4s[0]?.url ?? null
}

function photoUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('name')) parsed.searchParams.set('name', 'orig')
    return parsed.toString()
  } catch {
    return url
  }
}

function isAllowedMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('twimg.com')
  } catch {
    return false
  }
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  })
  if (!response.ok) throw new Error('No se pudo leer el post')
  return response.json()
}

export async function explorePost(link: string): Promise<PostMediaItem[]> {
  const id = statusIdFromLink(link)
  if (!id) throw new Error('Pega un link de un post de x.com')

  const data = (await readJson(
    `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&token=a`
  )) as { mediaDetails?: MediaDetail[] }

  const items: PostMediaItem[] = []
  let images = 0
  let videos = 0

  for (const media of data.mediaDetails ?? []) {
    if (media.type === 'photo' && media.media_url_https) {
      images += 1
      items.push({
        kind: 'image',
        url: photoUrl(media.media_url_https),
        label: `Imagen ${images}`
      })
      continue
    }
    if (media.type === 'video' || media.type === 'animated_gif') {
      const url = bestMp4(media.video_info?.variants)
      if (!url) continue
      videos += 1
      items.push({ kind: 'video', url, label: `Video ${videos}` })
    }
  }

  if (items.length === 0) throw new Error('Este post no tiene imágenes ni videos')
  return items.filter((item) => isAllowedMediaUrl(item.url))
}

function extensionFor(url: string, kind: 'image' | 'video'): string {
  if (kind === 'video') return 'mp4'
  try {
    const ext = basename(new URL(url).pathname).split('.').pop()?.toLowerCase()
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
  } catch {
    // ignore
  }
  return 'jpg'
}

function downloadTo(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, redirect: 'follow' })
    request.setHeader('Referer', 'https://x.com/')
    request.setHeader('Accept', '*/*')
    let total = 0
    request.on('response', (response) => {
      if ((response.statusCode ?? 0) >= 400) {
        reject(new Error(`No se pudo descargar (${response.statusCode})`))
        return
      }
      let failed = false
      const file = createWriteStream(filePath)
      const fail = (error: Error): void => {
        if (failed) return
        failed = true
        file.destroy()
        reject(error)
      }
      response.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_BYTES) {
          request.abort()
          fail(new Error('El archivo supera 250 MB'))
          return
        }
        file.write(chunk)
      })
      response.on('end', () => {
        if (failed) return
        file.end(() => resolve())
      })
      response.on('error', (error) => fail(error instanceof Error ? error : new Error('No se pudo descargar')))
    })
    request.on('error', reject)
    request.end()
  })
}

export async function savePostMedia(item: PostMediaItem): Promise<boolean> {
  if (!isAllowedMediaUrl(item.url)) throw new Error('Ese archivo no se puede guardar')
  const ext = extensionFor(item.url, item.kind)
  const result = await dialog.showSaveDialog({
    title: `Guardar ${item.label}`,
    defaultPath: `${item.label.replace(/\s+/g, '-')}.${ext}`,
    buttonLabel: 'Guardar',
    filters:
      item.kind === 'video'
        ? [{ name: 'Video', extensions: ['mp4'] }]
        : [{ name: 'Imagen', extensions: [ext, 'jpg', 'png', 'webp', 'gif'] }]
  })
  if (result.canceled || !result.filePath) return false
  await downloadTo(item.url, result.filePath)
  return true
}
