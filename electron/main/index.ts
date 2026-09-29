import { app, BrowserWindow, ipcMain, shell, webContents } from 'electron'
import { join } from 'path'
import type { ColumnConfig, ColumnLayoutSlot, Rect } from '../../shared/types'
import { APP_AUTHOR, APP_AUTHOR_URL, APP_NAME, APP_VERSION } from '../../shared/version'
import { ColumnManager } from './browser/columnManager'
import { LoginManager } from './browser/loginManager'
import { SessionStore } from './config/store'
import { exportCookiesBackup } from './session/partitions'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
const store = new SessionStore()
const columns = new ColumnManager(store)
const login = new LoginManager(store)

function resourcesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources')
  }
  return join(__dirname, '../../resources')
}

function appIconPath(): string {
  return join(resourcesDir(), 'icon.png')
}

function showSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 520,
    height: 520,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  void splash.loadFile(join(resourcesDir(), 'splash.html'))
  splash.once('ready-to-show', () => {
    splash.center()
    splash.show()
  })
  splashWindow = splash
  return splash
}

function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
  }
  splashWindow = null
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    show: false,
    backgroundColor: '#000000',
    icon: appIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  columns.attach(mainWindow)
  login.attach(mainWindow, () => {
    void refreshApp()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  let mainReady = false
  let splashMinTimeDone = false

  const reveal = (): void => {
    if (!mainReady || !splashMinTimeDone) return
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.show()
    mainWindow.focus()
    closeSplash()
  }

  mainWindow.once('ready-to-show', () => {
    mainReady = true
    reveal()
  })

  // Splash stays up at least 5s from when it first appears
  if (splashWindow && !splashWindow.isDestroyed()) {
    const armSplashTimer = (): void => {
      setTimeout(() => {
        splashMinTimeDone = true
        reveal()
      }, 5000)
    }
    if (splashWindow.isVisible()) {
      armSplashTimer()
    } else {
      splashWindow.once('ready-to-show', armSplashTimer)
    }
  } else {
    splashMinTimeDone = true
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function refreshApp(): Promise<void> {
  store.reload()
  login.hide()
  if (store.hasLoggedInSession()) {
    await columns.rebuild()
  } else {
    await columns.dispose()
  }
  mainWindow?.webContents.send('app:state', snapshot())
}

function snapshot() {
  const config = store.getConfig()
  return {
    columnWidth: config.columnWidth,
    sessions: store.loggedInSessions(),
    columns: config.columns,
    hasLoggedIn: store.hasLoggedInSession()
  }
}

function resolveSessionIdFromSender(webContentsId: number): string | null {
  const wc = webContents.fromId(webContentsId)
  if (wc) {
    const part = (wc.session as { partition?: string }).partition || ''
    const prefix = 'persist:fluxdeck-'
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length)
    }
  }
  return login.getActiveSessionId()
}

function registerIpc(): void {
  ipcMain.handle('app:getState', () => snapshot())

  ipcMain.handle('app:getInfo', () => ({
    name: APP_NAME,
    version: APP_VERSION,
    author: APP_AUTHOR,
    authorUrl: APP_AUTHOR_URL
  }))

  ipcMain.handle('columns:reloadAll', () => {
    columns.reloadAll()
  })

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      await shell.openExternal(url)
    }
  })

  ipcMain.handle('login:startFirst', async (_e, bounds: Rect) => {
    columns.hideAll()
    await login.startFirstLogin(bounds)
    return { ok: true }
  })

  ipcMain.handle('login:startAdd', async (_e, bounds: Rect) => {
    columns.hideAll()
    const id = await login.startAddAccount(bounds)
    return { sessionId: id }
  })

  ipcMain.handle('login:setBounds', (_e, bounds: Rect) => {
    login.setBounds(bounds)
  })

  ipcMain.handle('login:cancel', async () => {
    await login.cancel()
    await refreshApp()
  })

  ipcMain.handle('columns:layout', (_e, slots: ColumnLayoutSlot[]) => {
    columns.syncLayout(slots)
  })

  ipcMain.handle('columns:hide', () => {
    columns.hideAll()
  })

  ipcMain.handle('columns:rebuild', async () => {
    if (store.hasLoggedInSession()) {
      await columns.rebuild()
    }
  })

  ipcMain.handle('columns:add', async (_e, column: ColumnConfig) => {
    store.addColumn(column)
    await refreshApp()
    return snapshot()
  })

  ipcMain.handle('columns:remove', async (_e, index: number) => {
    store.removeColumn(index)
    await refreshApp()
    return snapshot()
  })

  ipcMain.handle('columns:move', async (_e, index: number, delta: number) => {
    store.moveColumn(index, delta)
    await refreshApp()
    return snapshot()
  })

  ipcMain.handle('sessions:remove', async (_e, sessionId: string) => {
    store.remove(sessionId)
    await refreshApp()
    return snapshot()
  })

  ipcMain.on('flux:message', (event, payload: { type: string; body: unknown }) => {
    if (payload.type === 'scrollHorizontal' && typeof payload.body === 'number') {
      mainWindow?.webContents.send('columns:wheel', payload.body)
      return
    }

    const sessionId = resolveSessionIdFromSender(event.sender.id)
    if (!sessionId) return

    if (payload.type === 'userName' && typeof payload.body === 'string') {
      login.handleUserName(sessionId, payload.body)
    }
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(appIconPath())
    } catch {
      // ignore
    }
  }
  showSplash()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showSplash()
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeSplash()
  void columns.dispose()
  for (const s of store.loggedInSessions()) {
    exportCookiesBackup(store, s.id).catch(() => {})
  }
  if (process.platform !== 'darwin') app.quit()
})
