import { app, type Session, type WebContents } from 'electron'

const patchedSessions = new WeakSet<Session>()
const patchedContents = new WeakSet<WebContents>()

/** Chromium user agent without the Electron token X uses to withhold video. */
export function browserUserAgent(): string {
  return app.userAgentFallback.replace(/\sElectron\/\S+/g, '').replace(/\s{2,}/g, ' ').trim()
}

function chromeMajor(ua: string): string {
  return ua.match(/Chrome\/(\d+)/)?.[1] ?? '132'
}

function platformName(): string {
  if (process.platform === 'darwin') return 'macOS'
  if (process.platform === 'win32') return 'Windows'
  return 'Linux'
}

function pageIdentityScript(ua: string): string {
  const major = chromeMajor(ua)
  const platform = platformName()
  return `(() => {
    const ua = ${JSON.stringify(ua)};
    const major = ${JSON.stringify(major)};
    const platform = ${JSON.stringify(platform)};
    const brands = [
      { brand: 'Chromium', version: major },
      { brand: 'Google Chrome', version: major },
      { brand: 'Not_A Brand', version: '24' }
    ];
    const data = {
      brands,
      mobile: false,
      platform,
      toJSON() { return { brands, mobile: false, platform }; },
      getHighEntropyValues() {
        return Promise.resolve({
          brands,
          fullVersionList: brands,
          mobile: false,
          platform,
          architecture: 'arm',
          bitness: '64',
          model: '',
          platformVersion: '15.0.0',
          uaFullVersion: major + '.0.0.0'
        });
      }
    };
    try {
      Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua });
      Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => data });
    } catch (e) {}
  })();`
}

export function applyBrowserIdentity(ses: Session): void {
  if (patchedSessions.has(ses)) return
  patchedSessions.add(ses)

  const ua = browserUserAgent()
  ses.setUserAgent(ua)
  const major = chromeMajor(ua)

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    for (const key of Object.keys(headers)) {
      if (!key.toLowerCase().startsWith('sec-ch-ua')) continue
      const value = headers[key]
      if (!value || !/electron/i.test(value)) continue
      headers[key] = value.replace(/"Electron";v="[^"]*"/g, `"Google Chrome";v="${major}"`)
    }
    callback({ requestHeaders: headers })
  })
}

/** Run before the first page script so X reads a normal Chrome identity. */
export function installPageIdentity(webContents: WebContents): void {
  const ua = browserUserAgent()
  webContents.setUserAgent(ua)
  if (patchedContents.has(webContents)) return
  patchedContents.add(webContents)

  try {
    if (!webContents.debugger.isAttached()) webContents.debugger.attach('1.3')
    void webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: pageIdentityScript(ua)
    })
  } catch {
    // The header user agent still applies if the debugger is unavailable.
  }
}
