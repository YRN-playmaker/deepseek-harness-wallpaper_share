// ============================================================
// we-sync · Wallpaper Engine ↔ DeepSeek Harness 壁纸同步
// Client 半 —— 粘贴到 cordis_define 的 code.client
//
// 无敏感信息：仅做主题覆盖、背景渲染与标签页控制面板。
// ============================================================

return {
  inject: ['timer'],
  apply(ctx) {
    const theme = ctx.get('theme')
    const slots = ctx.get('slots')
    if (theme === undefined || slots === undefined) return

    const settings = { enabled: true, panelAlpha: 72, blur: 6, shadow: 30 }
    let currentInfo = null
    let lastVersion = -1
    const listeners = []
    const subscribe = (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) } }
    const notify = () => { for (const l of listeners.slice()) { try { l() } catch (e) {} } }

    let themeDisposer = null
    function applyTheme() {
      if (themeDisposer !== null) { themeDisposer(); themeDisposer = null }
      const a = 0.30 + (settings.panelAlpha / 100) * 0.60
      const dark = {
        '--dsw-alias-bg-base': 'rgba(15,16,20,' + a.toFixed(3) + ')',
        '--dsw-alias-bg-layer-1': 'rgba(24,26,32,' + (a * 0.95).toFixed(3) + ')',
        '--dsw-alias-bg-layer-2': 'rgba(31,33,40,' + (a * 0.90).toFixed(3) + ')',
        '--dsw-alias-bg-overlay': 'rgba(22,24,29,' + Math.min(a + 0.12, 0.96).toFixed(3) + ')',
        '--dsw-specific-sidebar-fill': 'rgba(13,14,17,' + (a * 0.92).toFixed(3) + ')',
      }
      const light = {
        '--dsw-alias-bg-base': 'rgba(246,247,250,' + Math.min(a + 0.10, 0.95).toFixed(3) + ')',
        '--dsw-alias-bg-layer-1': 'rgba(255,255,255,' + (a * 0.95).toFixed(3) + ')',
        '--dsw-alias-bg-layer-2': 'rgba(251,252,253,' + (a * 0.90).toFixed(3) + ')',
        '--dsw-alias-bg-overlay': 'rgba(255,255,255,' + Math.min(a + 0.14, 0.97).toFixed(3) + ')',
        '--dsw-specific-sidebar-fill': 'rgba(238,240,244,' + (a * 0.92).toFixed(3) + ')',
      }
      const tokens = {}
      for (const key of Object.keys(dark)) tokens[key] = { light: light[key], dark: dark[key] }
      themeDisposer = theme.overrideTokens('we-sync', tokens)
    }
    ctx.effect(() => () => { if (themeDisposer !== null) { themeDisposer(); themeDisposer = null } })

    let bgDisposer = null
    function applyBackground() {
      if (bgDisposer !== null) { bgDisposer(); bgDisposer = null }
      const hasImage = settings.enabled && currentInfo !== null && currentInfo.kind === 'image'
      const img = hasImage ? 'url("/we-sync/preview?v=' + currentInfo.version + '")' : 'none'
      const blurPx = Math.round(settings.blur)
      const scale = 1 + blurPx / 400
      const shadowAlpha = (settings.shadow / 100) * 0.60
      bgDisposer = styles.insert(
        'html { background-color: #0d0e12; }' +
        'body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; ' +
        'background-image: ' + img + '; background-size: cover; background-position: center; background-repeat: no-repeat; ' +
        'filter: blur(' + blurPx + 'px); transform: scale(' + scale.toFixed(3) + '); transition: filter 0.12s linear; }' +
        'body::after { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -1; ' +
        'background: linear-gradient(rgba(6,8,12,' + shadowAlpha.toFixed(3) + '), rgba(6,8,12,' + (shadowAlpha * 0.85).toFixed(3) + ')); }'
      )
    }
    ctx.effect(() => () => { if (bgDisposer !== null) { bgDisposer(); bgDisposer = null } })

    let polling = false
    async function poll() {
      if (polling) return
      polling = true
      try {
        const result = await host.call('state', {})
        if (result !== null && typeof result === 'object') {
          const changed = typeof result.version === 'number' && result.version !== lastVersion
          currentInfo = result
          notify()
          if (changed) { lastVersion = result.version; applyBackground() }
        }
      } catch (e) {}
      polling = false
    }

    styles.insert(
      '.wesync-panel { padding: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 660px; box-sizing: border-box; }' +
      '.wesync-card { padding: 16px 18px; border-radius: 12px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); }' +
      '.wesync-title { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); margin: 0 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
      '.wesync-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); }' +
      '.wesync-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }' +
      '.wesync-row label { flex: 0 0 92px; font-size: 12px; color: var(--dsw-alias-label-secondary); }' +
      '.wesync-row input[type=range] { flex: 1; accent-color: var(--dsw-alias-brand-primary); height: 20px; }' +
      '.wesync-row output { flex: 0 0 44px; text-align: right; font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }' +
      '.wesync-btn { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 13px; font-family: inherit; }' +
      '.wesync-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-overlay); }' +
      '.wesync-btn:disabled { opacity: 0.5; cursor: default; }'
    )

    function Slider(props) {
      return React.createElement('div', { className: 'wesync-row' },
        React.createElement('label', null, props.label),
        React.createElement('input', {
          type: 'range', min: props.min, max: props.max, step: props.step || 1, value: props.value,
          onChange: (e) => props.onChange(Number(e.target.value)),
        }),
        React.createElement('output', null, String(props.value) + (props.unit || '')),
      )
    }

    function Panel() {
      const [, force] = React.useState(0)
      const [info, setInfo] = React.useState(currentInfo)
      const [enabled, setEnabled] = React.useState(settings.enabled)
      const [alpha, setAlpha] = React.useState(settings.panelAlpha)
      const [blur, setBlur] = React.useState(settings.blur)
      const [shadow, setShadow] = React.useState(settings.shadow)
      const [busy, setBusy] = React.useState(false)
      const [status, setStatus] = React.useState('')

      React.useEffect(() => subscribe(() => { setInfo(currentInfo); force((x) => x + 1) }), [])

      const flash = (text) => {
        setStatus(text)
        ctx.timeout(() => setStatus(''), 3500)
      }

      const onAlpha = (v) => { settings.panelAlpha = v; setAlpha(v); applyTheme() }
      const onBlur = (v) => { settings.blur = v; setBlur(v); applyBackground() }
      const onShadow = (v) => { settings.shadow = v; setShadow(v); applyBackground() }
      const onPower = () => {
        const next = !settings.enabled
        settings.enabled = next
        setEnabled(next)
        applyBackground()
        flash(next ? '已开启壁纸同步' : '已关闭壁纸同步')
      }
      const onRandom = async () => {
        if (busy) return
        setBusy(true)
        try {
          const result = await host.call('random', {})
          if (result === null || typeof result !== 'object') flash('切换失败：无响应')
          else if (result.ok) flash('已随机切换壁纸')
          else flash('切换失败：' + String(result.error || ('退出码 ' + result.code)))
        } catch (e) { flash('切换失败') }
        finally { setBusy(false) }
      }

      const wallpaper = info !== null && info.wallpaper !== null ? info.wallpaper : null
      const title = wallpaper === null
        ? (info !== null && info.kind === 'web' ? '当前为网页壁纸（无本地预览）' : 'Wallpaper Engine 尚未应用壁纸')
        : String(wallpaper.title)
      const subtitle = wallpaper === null
        ? '在 Wallpaper Engine 中应用壁纸后，此处会同步显示'
        : (String(wallpaper.type || '') + (info !== null && info.kind === 'image' ? ' · 已同步静态预览' : ' · 无静态预览图'))

      return React.createElement('div', { className: 'wesync-panel' },
        React.createElement('div', { className: 'wesync-card' },
          React.createElement('div', { className: 'wesync-title' }, title),
          React.createElement('div', { className: 'wesync-sub' }, subtitle),
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } },
            React.createElement('button', { className: 'wesync-btn', onClick: onRandom, disabled: busy }, busy ? '切换中…' : '🎲 随机换一张'),
            React.createElement('button', { className: 'wesync-btn', onClick: onPower }, enabled ? '⏻ 同步开启' : '⏻ 同步关闭'),
          ),
          status ? React.createElement('div', { className: 'wesync-sub', style: { marginTop: 10 } }, status) : null,
        ),
        React.createElement('div', { className: 'wesync-card' },
          React.createElement('div', { className: 'wesync-sub', style: { marginBottom: 2 } }, '视觉效果 · 即时生效'),
          React.createElement(Slider, { label: '面板透明度', min: 0, max: 100, value: alpha, unit: '%', onChange: onAlpha }),
          React.createElement(Slider, { label: '背景模糊', min: 0, max: 30, value: blur, unit: 'px', onChange: onBlur }),
          React.createElement(Slider, { label: '阴影深度', min: 0, max: 100, value: shadow, unit: '%', onChange: onShadow }),
        ),
      )
    }

    applyTheme()
    applyBackground()
    ctx.interval(poll, 2500)
    void poll()

    slots.inject('conversation.view', () => slots.register(
      { name: 'conversation.view', id: 'wallpaper_share', order: 20, label: 'wallpaper_share' },
      () => React.createElement(Panel),
    ))
  },
}
