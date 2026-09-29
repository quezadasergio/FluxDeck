import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fluxdeck', {
  send: (type: string, body: unknown): void => {
    ipcRenderer.send('flux:message', { type, body })
  }
})
