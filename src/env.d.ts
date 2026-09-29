/// <reference types="vite/client" />

import type { FluxDeckApi } from '../electron/preload/index'

declare global {
  interface Window {
    fluxdeckApi: FluxDeckApi
    fluxdeck?: {
      send: (type: string, body: unknown) => void
    }
  }
}

export {}
