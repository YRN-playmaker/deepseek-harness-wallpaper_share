/**
 * wallpaper_share 会话视图标签页：当前壁纸信息、随机切换、同步开关，
 * 以及透明度 / 模糊 / 阴影三个滑块（即时生效）。
 */
import { useEffect, useState } from 'react'
import css from './panel.module.css'
import { store, type WeSyncInfo } from './index'

export function WallpaperSharePanel() {
  const [, force] = useState(0)
  const [info, setInfo] = useState<WeSyncInfo | null>(store.info)
  const [enabled, setEnabled] = useState(store.settings.enabled)
  const [alpha, setAlpha] = useState(store.settings.panelAlpha)
  const [blur, setBlur] = useState(store.settings.blur)
  const [shadow, setShadow] = useState(store.settings.shadow)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [monitor, setMonitor] = useState(store.settings.monitor)

  useEffect(() => store.subscribe(() => {
    setInfo(store.info)
    force((x) => x + 1)
  }), [])

  const flash = (text: string): void => {
    setStatus(text)
    window.setTimeout(() => setStatus(''), 3500)
  }

  const onAlpha = (v: number): void => {
    store.settings.panelAlpha = v
    setAlpha(v)
    store.actions.applyTheme()
  }

  const onBlur = (v: number): void => {
    store.settings.blur = v
    setBlur(v)
    store.actions.applyBackground()
  }

  const onShadow = (v: number): void => {
    store.settings.shadow = v
    setShadow(v)
    store.actions.applyBackground()
  }

  const onPower = (): void => {
    const next = !store.settings.enabled
    store.settings.enabled = next
    setEnabled(next)
    store.actions.applyBackground()
    flash(next ? '已开启壁纸同步' : '已关闭壁纸同步')
  }

  const onMonitor = (v: string): void => {
    store.settings.monitor = v
    setMonitor(v)
    store.actions.repoll()
  }

  const onRandom = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/we-sync/random', { cache: 'no-store' })
      const result = await res.json() as { ok?: boolean; error?: string; workshopId?: string }
      if (result.ok === true) flash('已随机切换壁纸')
      else flash('切换失败：' + String(result.error ?? '无响应'))
    } catch {
      flash('切换失败')
    } finally {
      setBusy(false)
    }
  }

  const wallpaper = info !== null && info.wallpaper !== null ? info.wallpaper : null
  const title = wallpaper === null
    ? (info !== null && info.kind === 'web' ? '当前为网页壁纸（无本地预览）' : 'Wallpaper Engine 尚未应用壁纸')
    : wallpaper.title
  const subtitle = wallpaper === null
    ? '在 Wallpaper Engine 中应用壁纸后，此处会同步显示'
    : wallpaper.type + (info !== null && info.kind === 'image' ? ' · 已同步静态预览' : ' · 无静态预览图') + (info !== null && info.monitor !== '' ? ' · 显示器 ' + info.monitor : '')

  const monitors = info !== null && Array.isArray(info.monitors) && info.monitors.length > 1 ? info.monitors : null

  return (
    <div className={css.panel}>
      <div className={css.card}>
        <div className={css.title}>{title}</div>
        <div className={css.sub}>{subtitle}</div>
        {monitors !== null
          ? (
              <div className={css.row}>
                <label>背景显示器</label>
                <select
                  className={css.select}
                  value={monitor}
                  onChange={(e) => onMonitor(e.target.value)}
                >
                  <option value="">自动 · 跟随最新变化</option>
                  {monitors.map((m) => (
                    <option key={m.key} value={m.key}>{m.key + ' · ' + m.title}</option>
                  ))}
                </select>
                <output>{monitor === '' ? 'auto' : monitor}</output>
              </div>
            )
          : null}
        <div className={css.actions}>
          <button className={css.btn} onClick={() => void onRandom()} disabled={busy}>
            {busy ? '切换中…' : '🎲 随机换一张'}
          </button>
          <button className={css.btn} onClick={onPower}>
            {enabled ? '⏻ 同步开启' : '⏻ 同步关闭'}
          </button>
        </div>
        {status !== '' ? <div className={css.status}>{status}</div> : null}
      </div>
      <div className={css.card}>
        <div className={css.sub}>视觉效果 · 即时生效</div>
        <Slider label="面板透明度" min={0} max={100} value={alpha} unit="%" onChange={onAlpha} />
        <Slider label="背景模糊" min={0} max={30} value={blur} unit="px" onChange={onBlur} />
        <Slider label="阴影深度" min={0} max={100} value={shadow} unit="%" onChange={onShadow} />
      </div>
    </div>
  )
}

function Slider(props: {
  label: string
  min: number
  max: number
  value: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className={css.row}>
      <label>{props.label}</label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <output>{String(props.value) + props.unit}</output>
    </div>
  )
}
