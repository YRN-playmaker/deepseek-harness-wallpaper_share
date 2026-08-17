/**
 * we-sync · browser half
 * 玻璃面板主题覆盖 + 壁纸背景层 + wallpaper_share 会话视图标签页。
 * 与 node half 通过同源 HTTP 路由（/we-sync/state、/we-sync/preview、
 * /we-sync/random）通信，不依赖任何 RPC 基础设施。
 * 多显示器：?monitor= 锁定某台；不传则跟随"最近变化"的一台。
 */
import { WallpaperSharePanel } from './WallpaperSharePanel.tsx'
import { PANEL_CSS } from './panelStyle.ts'

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
  /** 当前生效显示器的源文件类型（'video' | 'web' | 'scene' | 'application' | 'image' | 'other' | ''） */
  source: { kind: string; mime: string }
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
  /** 渲染模式：'preview' 性能（预览图）| 'source' 增强（壁纸源文件，视频/Web 可用） */
  renderMode: 'preview' | 'source'
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
  settings: { enabled: true, panelAlpha: 72, blur: 6, shadow: 30, monitor: '', focus: false, taskActive: false, renderMode: 'preview' } as WeSyncSettings,
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

/** 最小化的 Cordis 上下文结构（独立构建不依赖 @deepseek-ai/cordis 的类型包） */
interface CordisCtx {
  get(name: string): unknown
  effect(callback: () => (() => void) | void): void
}

export function apply(ctx: CordisCtx): void {
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

  const panelStyleTag = document.createElement('style')
  panelStyleTag.dataset.plugin = 'we-sync-dsh'
  panelStyleTag.textContent = PANEL_CSS
  document.head.appendChild(panelStyleTag)

  // 增强模式媒体层：视频或 iframe（性能模式不创建）
  let mediaEl: HTMLVideoElement | HTMLIFrameElement | null = null

  function setMedia(el: HTMLVideoElement | HTMLIFrameElement | null): void {
    if (mediaEl !== null && mediaEl !== el) {
      if (mediaEl instanceof HTMLVideoElement) mediaEl.pause()
      mediaEl.remove()
    }
    mediaEl = el
    if (el !== null) {
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.zIndex = '-2'
      el.style.pointerEvents = 'none'
      el.style.border = '0'
      document.body.appendChild(el)
    }
  }

  function applyBackground(): void {
    const info = store.info
    const visuals = effectiveVisuals()
    const enabled = store.settings.enabled
    const blurPx = Math.round(visuals.blur)
    const scale = 1 + blurPx / 400
    const shadowAlpha = (visuals.shadow / 100) * 0.60
    const monitorKey = info !== null && info.monitor !== '' ? info.monitor : ''
    const monitorQuery = store.settings.monitor !== '' ? '&monitor=' + encodeURIComponent(store.settings.monitor) : ''
    const sourceKind = enabled && info !== null && store.settings.renderMode === 'source' ? info.source.kind : ''

    // 预览图（性能模式 / 增强模式下非视频非 Web 时回退）
    let imgUrl = 'none'
    if (enabled && info !== null && info.kind === 'image' && sourceKind === '') {
      imgUrl = 'url("/we-sync/preview?v=' + info.version + monitorQuery + '")'
    }

    styleTag.textContent =
      'html { background-color: #0d0e12; }' +
      (imgUrl !== 'none'
        ? 'body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; ' +
          'background-image: ' + imgUrl + '; background-size: cover; background-position: center; background-repeat: no-repeat; ' +
          'filter: blur(' + blurPx + 'px); transform: scale(' + scale.toFixed(3) + '); transition: filter 0.12s linear; }'
        : '') +
      'body::after { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; ' +
      'background: linear-gradient(rgba(6,8,12,' + shadowAlpha.toFixed(3) + '), rgba(6,8,12,' + (shadowAlpha * 0.85).toFixed(3) + ')); }'

    if (sourceKind === 'video' && info !== null) {
      let video = mediaEl instanceof HTMLVideoElement ? mediaEl : null
      if (video === null) {
        video = document.createElement('video')
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.autoplay = true
        setMedia(video)
      }
      const src = '/we-sync/source?monitor=' + encodeURIComponent(monitorKey) + '&v=' + info.version
      if (video.src !== location.origin + src) video.src = src
      video.style.filter = 'blur(' + blurPx + 'px)'
      video.style.transform = 'scale(' + scale.toFixed(3) + ')'
      video.style.objectFit = 'cover'
      const p = video.play()
      if (p !== undefined && p !== null) void p.catch(() => { /* 自动播放被浏览器拦截时静默 */ })
    } else if (sourceKind === 'web' && info !== null) {
      let frame = mediaEl instanceof HTMLIFrameElement ? mediaEl : null
      if (frame === null) {
        frame = document.createElement('iframe')
        frame.setAttribute('sandbox', 'allow-scripts')
        setMedia(frame)
      }
      const src = '/we-sync/wallpaper/index.html?monitor=' + encodeURIComponent(monitorKey) + '&v=' + info.version
      if (frame.src !== location.origin + src) frame.src = src
      frame.style.filter = 'blur(' + blurPx + 'px)'
    } else {
      setMedia(null)
    }
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
    panelStyleTag.remove()
    setMedia(null)
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
