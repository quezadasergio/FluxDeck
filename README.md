# FluxDeck

Multi-column desktop client for X (Twitter), inspired by [XDeck](https://github.com/morishin/XDeck). Built with **Electron** (native Chromium) and isolated sessions per account.

Requirements: **Node.js 20+**, Windows / macOS / Linux.

## Run (development)

```sh
npm install
npm run dev
```

Config is stored at:

- macOS / Linux: `~/.config/FluxDeck/settings.json`
- Windows: `%APPDATA%\FluxDeck\settings.json`

Each session uses a persistent Electron partition (`persist:fluxdeck-<id>`). If you are migrating from the previous Java client, cookies in `sessions/<id>/cookies.json` are imported automatically on first launch.

## Usage

1. **Add account** — opens `x.com` to sign in. The username is detected automatically.
2. **Add column** — pick an account and type: For You, Following, Notifications, Profile, or URL.
3. **Post** — in each column (using that column’s account): **+** button at the bottom right, or right-click → Chromium menu on X’s compose UI.
4. **Copy / paste** — right-click with a Chromium-style menu (copy image, paste into compose, links, etc.).
5. **Refresh** — ↻ in the toolbar reloads all columns.
6. **About** — **i** shows version and credit.

App version lives in [`shared/version.ts`](shared/version.ts) (`APP_VERSION`).

Columns can be reordered (‹ ›) or closed. Layout is persisted in `settings.json`.

## Packaging

### On your machine

```sh
# macOS → .dmg
npm run dist:mac

# Windows → .exe (best on a Windows PC)
npm run dist:win
```

Installers land in `release/`.

### With GitHub Actions (Mac + Windows)

1. Push the code to your GitHub repo.
2. Open the **Actions** tab → **Build installers** workflow → **Run workflow**  
   (or create a tag: `git tag v1.0.0 && git push origin v1.0.0`).
3. When it finishes, download the `FluxDeck-mac` and `FluxDeck-windows` artifacts.
4. If you used a `v*` tag, a **Release** is also created with the `.dmg` and `.exe`.

Notes:
- The Mac CI build is **unsigned** (Gatekeeper may warn). Signing/notarization would need certificates in secrets.
- The Windows CI build is also unsigned (SmartScreen may warn).

## Architecture (brief)

- UI shell: React (toolbar + column strip).
- Web: `WebContentsView` per column / login (native Chromium).
- Sessions: `session.fromPartition('persist:fluxdeck-' + id)`.
- Posting: x.com compose inside each column.
- Column scripts: hide header/ads, For You / Following tabs, post FAB.
