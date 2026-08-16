/**
 * we-sync · browser half
 * 玻璃面板主题覆盖 + 壁纸背景层 + wallpaper_share 会话视图标签页。
 * 与 node half 通过同源 HTTP 路由（/we-sync/state、/we-sync/preview、
 * /we-sync/random）通信，不依赖任何 RPC 基础设施。
 */
import type { Context } from '@deepseek-ai/cordis'
import { WallpaperSharePanel } from './WallpaperSharePanel.tsx'

export const inject = ['slots', 'theme']

export interface WeSyncInfo {
  version: number
  kind: string
  wallpaper: null | { title: string; type: string }
}

export interface WeSyncSettings {
  enabled: boolean
  panelAlpha: number
  blur: number
  shadow: number
}

/** 包内单例 store：apply 循环更新，面板组件订阅渲染。 */
export const store = {
  info: null as WeSyncInfo | null,
  settings: { enabled: true, panelAlpha: 72, blur: 6, shadow: 30 } as WeSyncSettings,
  listeners: new Set<() => void>(),
  actions: {
    applyTheme: (): void => {},
    applyBackground: (): void => {},
  },
  subscribe(fn: () => void): () => void {
    store.listeners.add(fn)
    return () => { store.listeners.delete(fn) }
  },
  notify(): void {
    for (const fn of store.listeners) fn()
  },
}

interface ThemeService {
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void
}

interface SlotsService {
  inject(key: string, callback: () => unknown): unknown
  register(registration: unknown, render: unknown): unknown
}

export function apply(ctx: Context): void {
  const theme = ctx.get('theme') as unknown as ThemeService | undefined
  const slots = ctx.get('slots') as unknown as SlotsService | undefined
  if (theme === undefined || slots === undefined) return

  const themeService = theme
  const slotsService = slots

  let themeDisposer: (() => void) | null = null
  function applyTheme(): void {
    if (themeDisposer !== null) { themeDisposer(); themeDisposer = null }
    const a = 0.30 + (store.settings.panelAlpha / 100) * 0.60
    const dark: Record<string, string> = {
      '--dsw-alias-bg-base': 'rgba(15,16,20,' + a.toFixed(3) + ')',
      '--dsw-alias-bg-layer-1': 'rgba(24,26,32,' + (a * 0.95).toFixed(3) + ')',
      '--dsw-alias-bg-layer-2': 'rgba(31,33,40,' + (a * 0.90).toFixed(3) + ')',
      '--dsw-alias-bg-overlay': 'rgba(22,24,29,' + Math.min(a + 0.12, 0.96).toFixed(3) + ')',
      '--dsw-specific-sidebar-fill': 'rgba(13,14,17,' + (a * 0.92).toFixed(3) + ')',
    }
    const light: Record<string, string> = {
      '--dsw-alias-bg-base': 'rgba(246,247,250,' + Math.min(a + 0.10, 0.95).toFixed(3) + ')',
      '--dsw-alias-bg-layer-1': 'rgba(255,255,255,' + (a * 0.95).toFixed(3) + ')',
      '--dsw-alias-bg-layer-2': 'rgba(251,252,253,' + (a * 0.90).toFixed(3) + ')',
      '--dsw-alias-bg-overlay': 'rgba(255,255,255,' + Math.min(a + 0.14, 0.97).toFixed(3) + ')',
      '--dsw-specific-sidebar-fill': 'rgba(238,240,244,' + (a * 0.92).toFixed(3) + ')',
    }
    const tokens: Record<string, { light: string; dark: string }> = {}
    for (const key of Object.keys(dark)) tokens[key] = { light: light[key] ?? '', dark: dark[key] ?? '' }
    themeDisposer = themeService.overrideTokens('we-sync', tokens)
  }

  const styleTag = document.createElement('style')
  styleTag.dataset.plugin = 'we-sync-dsh'
  document.head.appendChild(styleTag)

  function applyBackground(): void {
    const info = store.info
    const hasImage = store.settings.enabled && info !== null && info.kind === 'image'
    const img = hasImage ? 'url("/we-sync/preview?v=' + info.version + '")' : 'none'
    const blurPx = Math.round(store.settings.blur)
    const scale = 1 + blurPx / 400
    const shadowAlpha = (store.settings.shadow / 100) * 0.60
    styleTag.textContent =
      'html { background-color: #0d0e12; }' +
      'body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; ' +
      'background-image: ' + img + '; background-size: cover; background-position: center; background-repeat: no-repeat; ' +
      'filter: blur(' + blurPx + 'px); transform: scale(' + scale.toFixed(3) + '); transition: filter 0.12s linear; }' +
      'body::after { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; ' +
      'background: linear-gradient(rgba(6,8,12,' + shadowAlpha.toFixed(3) + '), rgba(6,8,12,' + (shadowAlpha * 0.85).toFixed(3) + ')); }'
  }

  store.actions.applyTheme = applyTheme
  store.actions.applyBackground = applyBackground

  ctx.effect(() => () => {
    styleTag.remove()
    if (themeDisposer !== null) { themeDisposer(); themeDisposer = null }
  })

  let lastVersion = -1
  async function poll(): Promise<void> {
    try {
      const res = await fetch('/we-sync/state', { cache: 'no-store' })
      if (!res.ok) return
      const info = await res.json() as WeSyncInfo
      const changed = typeof info.version === 'number' && info.version !== lastVersion
      store.info = info
      store.notify()
      if (changed) { lastVersion = info.version; applyBackground() }
    } catch { /* host 尚未就绪，下轮重试 */ }
  }

  ctx.effect(() => {
    const timer = setInterval(() => { void poll() }, 2500)
    void poll()
    return () => clearInterval(timer)
  })

  applyTheme()
  applyBackground()

  slotsService.inject('conversation.view', () => slotsService.register(
    { name: 'conversation.view', id: 'wallpaper_share', order: 20, label: 'wallpaper_share' },
    WallpaperSharePanel,
  ))
}
