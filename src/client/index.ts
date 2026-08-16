/**
 * we-sync · browser half
 * 玻璃面板主题覆盖 + 壁纸背景层 + wallpaper_share 会话视图标签页。
 * 与 node half 通过同源 HTTP 路由（/we-sync/state、/we-sync/preview、
 * /we-sync/random）通信，不依赖任何 RPC 基础设施。
 * 多显示器：?monitor= 锁定某台；不传则跟随"最近变化"的一台。
 */
import type { Context } from '@deepseek-ai/cordis'
import { WallpaperSharePanel } from './WallpaperSharePanel.tsx'

export const inject = ['slots', 'theme']

export interface WeSyncMonitor {
  key: string
  file: string
  title: string
  type: string
}

export interface WeSyncInfo {
  version: number
  kind: string
  hash: string
  monitor: string
  latestMonitor: string
  monitors: WeSyncMonitor[]
  wallpaper: null | { title: string; type: string }
}

export interface WeSyncSettings {
  enabled: boolean
  panelAlpha: number
  blur: number
  shadow: number
  /** 锁定的显示器 key；'' = 自动（跟随最近变化） */
  monitor: string
  /** 专注模式开关 */
  focus: boolean
  /** 当前会话是否有任务在进行（由 sessions 列表快照推导） */
  taskActive: boolean
}

/** 专注模式：任务进行中 */
export const FOCUS_WORK = { panelAlpha: 30, blur: 15, shadow: 90 }
/** 专注模式：任务全部完成 */
export const FOCUS_IDLE = { panelAlpha: 9, blur: 6, shadow: 40 }

/** 当前生效的视觉参数（专注模式覆盖用户滑块值） */
export function effectiveVisuals(): { panelAlpha: number; blur: number; shadow: number } {
  if (store.settings.focus) return store.settings.taskActive ? FOCUS_WORK : FOCUS_IDLE
  return { panelAlpha: store.settings.panelAlpha, blur: store.settings.blur, shadow: store.settings.shadow }
}

/** 包内单例 store：apply 循环更新，面板组件订阅渲染。 */
export const store = {
  info: null as WeSyncInfo | null,
  settings: { enabled: true, panelAlpha: 72, blur: 6, shadow: 30, monitor: '', focus: false, taskActive: false } as WeSyncSettings,
  listeners: new Set<() => void>(),
  actions: {
    applyTheme: (): void => {},
    applyBackground: (): void => {},
    repoll: (): void => {},
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

interface SessionsService {
  list: {
    getSnapshot(): { current?: string; byId: Record<string, { running?: boolean }> } | null
    subscribe(fn: () => void): () => void
  }
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
    const a = 0.30 + (effectiveVisuals().panelAlpha / 100) * 0.60
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
    const visuals = effectiveVisuals()
    const hasImage = store.settings.enabled && info !== null && info.kind === 'image'
    const monitorQuery = store.settings.monitor !== '' ? '&monitor=' + encodeURIComponent(store.settings.monitor) : ''
    const img = hasImage ? 'url("/we-sync/preview?v=' + info.version + monitorQuery + '")' : 'none'
    const blurPx = Math.round(visuals.blur)
    const scale = 1 + blurPx / 400
    const shadowAlpha = (visuals.shadow / 100) * 0.60
    styleTag.textContent =
      'html { background-color: #0d0e12; }' +
      'body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; ' +
      'background-image: ' + img + '; background-size: cover; background-position: center; background-repeat: no-repeat; ' +
      'filter: blur(' + blurPx + 'px); transform: scale(' + scale.toFixed(3) + '); transition: filter 0.12s linear; }' +
      'body::after { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; ' +
      'background: linear-gradient(rgba(6,8,12,' + shadowAlpha.toFixed(3) + '), rgba(6,8,12,' + (shadowAlpha * 0.85).toFixed(3) + ')); }'
  }

  let polling = false
  let lastHash = ''
  async function poll(): Promise<void> {
    if (polling) return
    polling = true
    try {
      const monitorQuery = store.settings.monitor !== '' ? '?monitor=' + encodeURIComponent(store.settings.monitor) : ''
      const res = await fetch('/we-sync/state' + monitorQuery, { cache: 'no-store' })
      if (!res.ok) return
      const info = await res.json() as WeSyncInfo
      const changed = typeof info.hash === 'string' && info.hash !== lastHash
      store.info = info
      store.notify()
      if (changed) { lastHash = info.hash; applyBackground() }
    } catch { /* host 尚未就绪，下轮重试 */ }
    polling = false
  }

  store.actions.applyTheme = applyTheme
  store.actions.applyBackground = applyBackground
  store.actions.repoll = () => { lastHash = ''; void poll() }

  ctx.effect(() => () => {
    styleTag.remove()
    if (themeDisposer !== null) { themeDisposer(); themeDisposer = null }
  })

  ctx.effect(() => {
    const timer = setInterval(() => { void poll() }, 2500)
    void poll()
    return () => clearInterval(timer)
  })

  // 任务状态检测：订阅 sessions 列表快照，当前会话 running = 任务进行中
  const sessions = ctx.get('sessions') as unknown as SessionsService | undefined
  if (sessions !== undefined) {
    const updateTaskState = (): void => {
      const snapshot = sessions.list.getSnapshot()
      const id = snapshot?.current
      const active = id !== undefined && snapshot !== null && snapshot.byId[id]?.running === true
      if (active !== store.settings.taskActive) {
        store.settings.taskActive = active
        if (store.settings.focus) { applyTheme(); applyBackground() }
        store.notify()
      }
    }
    ctx.effect(() => sessions.list.subscribe(updateTaskState))
    updateTaskState()
  }

  applyTheme()
  applyBackground()

  slotsService.inject('conversation.view', () => slotsService.register(
    { name: 'conversation.view', id: 'wallpaper_share', order: 20, label: 'wallpaper_share' },
    WallpaperSharePanel,
  ))
}
