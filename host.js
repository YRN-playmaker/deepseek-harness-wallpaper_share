// ============================================================
// we-sync · Wallpaper Engine ↔ DeepSeek Harness 壁纸同步
// Host 半 —— 粘贴到 cordis_define 的 code.host
//
// 无敏感信息：不含 Steam 用户名 / SteamID / 令牌。
// 安装目录默认自动检测（注册表 → 常见 Steam 路径），
// 检测不到时在 CONFIG.wallpaperEngineDir 手动指定。
// ============================================================

return {
  inject: ['timer'],
  apply(ctx) {
    const webServer = ctx.get('webServer')
    const shell = ctx.get('shell')
    if (webServer === undefined) return

    // ===================== 配置 =====================
    const CONFIG = {
      // Wallpaper Engine 安装目录；留空 = 自动检测
      // （1. 注册表 HKCU\Software\WallpaperEngine 的 installPath
      //   2. 常见 Steam 默认路径）
      wallpaperEngineDir: '',
      // 工作坊内容目录；留空自动推导为 <Steam库>/steamapps/workshop/content/431960
      workshopContentDir: '',
      // 轮询间隔（毫秒）
      pollIntervalMs: 2000,
      // 预览图大小上限（字节）
      previewMaxBytes: 6291456,
    }
    // ================================================

    const state = {
      version: 0,
      fingerprint: 'none',
      wallpaper: null,
      previewBytes: null,
      previewMime: '',
      previewKind: 'none',
      previewPath: '',
      lastError: '',
      weDir: '',
      steps: { config: 'pending', meta: '-', preview: '-', bytes: '-', pollCount: 0 },
    }

    let WE_DIR = ''
    const disposers = []
    ctx.effect(() => () => { for (const d of disposers) d() })

    function runCmd(command, stdoutMaxBytes) {
      if (shell === undefined) return Promise.reject(new Error('shell unavailable'))
      const spec = shell.resolve({ command: command, workdir: WE_DIR !== '' ? WE_DIR : 'C:/', timeoutMs: 20000, stdoutMaxBytes: stdoutMaxBytes })
      return shell.run(spec)
    }

    function b64decode(input) {
      const clean = String(input).replace(/[^A-Za-z0-9+/=]/g, '')
      const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const out = []
      let acc = 0
      let bits = 0
      for (let i = 0; i < clean.length; i++) {
        const c = clean.charAt(i)
        if (c === '=') break
        const v = table.indexOf(c)
        if (v < 0) continue
        acc = (acc << 6) | v
        bits += 6
        if (bits >= 8) {
          bits -= 8
          out.push((acc >> bits) & 255)
        }
      }
      const bytes = new Uint8Array(out.length)
      for (let i = 0; i < out.length; i++) bytes[i] = out[i]
      return bytes
    }

    async function fileExists(absPath) {
      const slash = String(absPath).replace(/\\/g, '/')
      const cmd = 'powershell -NoProfile -NonInteractive -Command "if([IO.File]::Exists(\'' + slash + '\')){exit 0}else{exit 1}"'
      const result = await runCmd(cmd, 65536)
      return result.exitCode === 0
    }

    function normalize(path) {
      return String(path).replace(/\\/g, '/')
    }

    async function detectWeDir() {
      // 1. 显式配置优先
      if (typeof CONFIG.wallpaperEngineDir === 'string' && CONFIG.wallpaperEngineDir.trim().length > 0) {
        return normalize(CONFIG.wallpaperEngineDir.trim())
      }
      // 2. 注册表（Wallpaper Engine 官方记录的安装路径）
      try {
        const cmd = 'powershell -NoProfile -NonInteractive -Command "(Get-ItemProperty -Path \'HKCU:\\Software\\WallpaperEngine\' -Name installPath -ErrorAction Stop).installPath"'
        const result = await runCmd(cmd, 8192)
        if (result.exitCode === 0) {
          const p = String(result.stdout.text || '').trim()
          if (p.length > 0) {
            return normalize(p).replace(/\/wallpaper(64|32)\.exe$/i, '')
          }
        }
      } catch (e) {}
      // 3. 常见 Steam 默认路径
      const defaults = [
        'C:/Program Files (x86)/Steam/steamapps/common/wallpaper_engine',
        'D:/Program Files (x86)/Steam/steamapps/common/wallpaper_engine',
        'C:/Steam/steamapps/common/wallpaper_engine',
        'D:/Steam/steamapps/common/wallpaper_engine',
      ]
      for (const dir of defaults) {
        try {
          if (await fileExists(dir + '/wallpaper64.exe')) return dir
        } catch (e) {}
      }
      return null
    }

    function resolveWorkshopDir() {
      const custom = CONFIG.workshopContentDir
      if (typeof custom === 'string' && custom.trim().length > 0) return custom.trim().replace(/\\/g, '/')
      const base = WE_DIR
      const idx = base.indexOf('/steamapps/common/')
      if (idx >= 0) return base.slice(0, idx) + '/steamapps/workshop/content/431960'
      return base.replace(/\/common\/[^/]+$/, '') + '/workshop/content/431960'
    }

    async function readLiveText(absPath) {
      const slash = String(absPath).replace(/\\/g, '/')
      const cmd = 'powershell -NoProfile -NonInteractive -Command "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText(\'' + slash + '\')))"'
      const result = await runCmd(cmd, 4194304)
      if (result.exitCode !== 0) throw new Error('read exit ' + result.exitCode)
      if (result.stdout.truncated) throw new Error('read stdout truncated')
      const bytes = b64decode(String(result.stdout.text))
      return new TextDecoder('utf-8').decode(bytes)
    }

    async function readLiveBytes(absPath, maxLen) {
      const slash = String(absPath).replace(/\\/g, '/')
      const cmd = 'powershell -NoProfile -NonInteractive -Command "if([IO.File]::ReadAllBytes(\'' + slash + '\').Length -gt ' + String(maxLen) + '){exit 3}; [Convert]::ToBase64String([IO.File]::ReadAllBytes(\'' + slash + '\'))"'
      const result = await runCmd(cmd, Math.ceil(maxLen * 4 / 3) + 4096)
      if (result.exitCode !== 0) throw new Error('bytes exit ' + result.exitCode)
      if (result.stdout.truncated) throw new Error('bytes stdout truncated')
      return b64decode(String(result.stdout.text))
    }

    async function readSelection() {
      const text = await readLiveText(WE_DIR + '/config.json')
      const root = JSON.parse(String(text).replace(/^\uFEFF/, ''))
      let cfg = null
      for (const key of Object.keys(root)) {
        const value = root[key]
        if (value !== null && typeof value === 'object' && value.general !== undefined) { cfg = value; break }
      }
      if (cfg === null || cfg.general === undefined) return null
      const general = cfg.general
      const wc = general.wallpaperconfig || {}
      const sel = wc.selectedwallpapers || {}
      const entries = []
      for (const key of Object.keys(sel)) {
        const value = sel[key]
        if (key.indexOf('Monitor') === 0 && value !== null && typeof value === 'object') entries.push([key, value])
      }
      if (entries.length === 0) return null
      const browser = general.browser || {}
      const last = browser.lastselectedmonitor
      let chosen = entries[0]
      for (const entry of entries) { if (entry[0] === last) { chosen = entry; break } }
      return chosen[1]
    }

    function primaryFile(entry) {
      if (typeof entry.file === 'string' && entry.file.length > 0) return entry.file
      if (entry.playlist !== null && typeof entry.playlist === 'object' && Array.isArray(entry.playlist.items)) {
        for (const item of entry.playlist.items) {
          if (item !== null && typeof item === 'object' && typeof item.file === 'string' && item.file.length > 0) return item.file
        }
      }
      return null
    }

    function dirOf(file) {
      const slash = String(file).replace(/\\/g, '/')
      const idx = slash.lastIndexOf('/')
      return idx >= 0 ? slash.slice(0, idx) : slash
    }

    async function resolveMeta(file, workshopDir) {
      const slash = String(file).replace(/\\/g, '/')
      const match = /431960\/(\d+)/.exec(slash)
      const id = match ? match[1] : ''
      let title = ''
      let type = ''
      try {
        const cache = JSON.parse(await readLiveText(WE_DIR + '/bin/workshopcache.json'))
        const list = Array.isArray(cache.wallpapers) ? cache.wallpapers : []
        const hit = id !== ''
          ? list.find((w) => String(w.workshopid) === id)
          : list.find((w) => typeof w.file === 'string' && w.file.replace(/\\/g, '/') === slash)
        if (hit !== undefined) { title = hit.title || ''; type = hit.type || '' }
      } catch (e) { state.steps.meta = 'cache error: ' + String((e && e.message) || e) }
      if (title === '') {
        try {
          const base = id !== '' ? workshopDir + '/' + id : dirOf(slash)
          const project = JSON.parse(await readLiveText(base + '/project.json'))
          if (project !== null && typeof project === 'object') {
            if (project.title) title = String(project.title)
            if (!type && project.type) type = String(project.type)
          }
        } catch (e) {}
      }
      if (title === '') title = id !== '' ? id : slash.slice(slash.lastIndexOf('/') + 1)
      return { title: title, type: type, id: id }
    }

    async function probePreview(dir) {
      const candidates = [['preview.jpg', 'image/jpeg'], ['preview.png', 'image/png'], ['preview.gif', 'image/gif']]
      const notes = []
      for (const candidate of candidates) {
        try {
          const exists = await fileExists(dir + '/' + candidate[0])
          if (exists) {
            state.steps.preview = 'found ' + candidate[0]
            return { path: dir + '/' + candidate[0], mime: candidate[1] }
          }
          notes.push(candidate[0] + '=missing')
        } catch (e) {
          notes.push(candidate[0] + '=error:' + String((e && e.message) || e))
        }
      }
      state.steps.preview = 'none found (' + notes.join(', ') + ')'
      return null
    }

    async function refresh(entry, fingerprint, workshopDir) {
      state.fingerprint = fingerprint
      state.lastError = ''
      if (entry === null) {
        state.wallpaper = null
        state.previewBytes = null
        state.previewKind = 'none'
        state.previewPath = ''
        state.version = state.version + 1
        return
      }
      const file = primaryFile(entry)
      if (file === null) {
        state.wallpaper = null
        state.previewBytes = null
        state.previewKind = 'none'
        state.previewPath = ''
        state.version = state.version + 1
        return
      }
      if (/^https?:\/\//i.test(file)) {
        state.wallpaper = { title: file, type: 'Web', id: '' }
        state.previewBytes = null
        state.previewKind = 'web'
        state.previewPath = ''
        state.version = state.version + 1
        return
      }
      const meta = await resolveMeta(file, workshopDir)
      const preview = await probePreview(dirOf(file))
      if (preview === null) {
        state.wallpaper = { title: meta.title, type: meta.type, id: meta.id }
        state.previewBytes = null
        state.previewKind = 'none'
        state.previewPath = ''
        state.version = state.version + 1
        return
      }
      state.previewPath = preview.path
      let bytes = null
      try { bytes = await readLiveBytes(preview.path, CONFIG.previewMaxBytes) } catch (e) {
        state.steps.bytes = 'error: ' + String((e && e.message) || e)
      }
      if (bytes === null || bytes === undefined || bytes.byteLength === 0) {
        state.wallpaper = { title: meta.title, type: meta.type, id: meta.id }
        state.previewBytes = null
        state.previewKind = 'none'
        state.version = state.version + 1
        return
      }
      state.steps.bytes = 'ok ' + bytes.byteLength + ' bytes'
      state.wallpaper = { title: meta.title, type: meta.type, id: meta.id }
      state.previewBytes = bytes
      state.previewMime = preview.mime
      state.previewKind = 'image'
      state.version = state.version + 1
    }

    let polling = false
    async function poll() {
      if (polling || WE_DIR === '') return
      polling = true
      try {
        state.steps.pollCount = state.steps.pollCount + 1
        const entry = await readSelection()
        state.steps.config = 'ok'
        const fingerprint = entry === null ? 'none' : JSON.stringify(entry)
        if (fingerprint !== state.fingerprint) await refresh(entry, fingerprint, resolveWorkshopDir())
      } catch (e) {
        state.steps.config = 'error: ' + String((e && e.message) || e)
        state.lastError = String((e && e.message) || e)
        console.error('we-sync poll failed: ' + state.lastError)
      } finally {
        polling = false
      }
    }

    disposers.push(webServer.register({
      kind: 'exact',
      path: '/we-sync/preview',
      handler(req, res) {
        if (state.previewBytes === null) { res.statusCode = 404; res.end('no preview: ' + state.lastError); return }
        res.statusCode = 200
        res.setHeader('Content-Type', state.previewMime)
        res.setHeader('Cache-Control', 'no-store')
        res.end(state.previewBytes)
      },
    }))

    disposers.push(webServer.register({
      kind: 'exact',
      path: '/we-sync/diag',
      handler(req, res) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({
          version: state.version,
          kind: state.previewKind,
          fingerprint: state.fingerprint,
          previewPath: state.previewPath,
          lastError: state.lastError,
          weDir: state.weDir,
          steps: state.steps,
          wallpaper: state.wallpaper === null ? null : { title: state.wallpaper.title, type: state.wallpaper.type, id: state.wallpaper.id },
        }))
      },
    }))

    disposers.push(harness.handle('state', async () => ({
      version: state.version,
      kind: state.previewKind,
      wallpaper: state.wallpaper === null ? null : { title: state.wallpaper.title, type: state.wallpaper.type },
    })))

    async function installedIds() {
      const cache = JSON.parse(await readLiveText(WE_DIR + '/bin/workshopcache.json'))
      const list = Array.isArray(cache.wallpapers) ? cache.wallpapers : []
      const ids = []
      for (const w of list) {
        if (w !== null && typeof w === 'object' && w.workshopid !== undefined && w.workshopid !== null) ids.push(String(w.workshopid))
      }
      return ids
    }

    disposers.push(harness.handle('random', async () => {
      if (shell === undefined) return { ok: false, error: 'shell 服务不可用' }
      try {
        const ids = await installedIds()
        if (ids.length === 0) return { ok: false, error: '没有可用的已安装壁纸' }
        const pick = ids[Math.floor(Math.random() * ids.length)]
        const result = await runCmd('"' + WE_DIR + '/wallpaper64.exe" -control openWallpaper -workshop ' + pick, 65536)
        void poll()
        return { ok: result.exitCode === 0, code: result.exitCode, workshopId: pick }
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) }
      }
    }))

    // 启动：检测安装目录 → 开始轮询
    void (async () => {
      const detected = await detectWeDir()
      if (detected === null) {
        state.lastError = '未找到 Wallpaper Engine 安装目录：请在 host.js 的 CONFIG.wallpaperEngineDir 手动指定'
        state.steps.config = 'error: wallpaper engine dir not found'
        console.error('we-sync: ' + state.lastError)
        return
      }
      WE_DIR = detected
      state.weDir = WE_DIR
      ctx.interval(poll, CONFIG.pollIntervalMs)
      void poll()
    })()
  },
}
