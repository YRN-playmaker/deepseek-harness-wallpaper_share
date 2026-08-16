# we-sync 一键安装脚本
# 用法（PowerShell）：
#   .\install.ps1                    # 从 npm registry 安装 we-sync-dsh
#   .\install.ps1 -Source <路径|git地址>
# 前置：已安装 pnpm；已用 dsh --profile web 启动过至少一次。
param(
  [string]$Source = 'we-sync-dsh',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\web'
$patchFile = Join-Path $profileDir 'cordis.patch.yml'

if (-not (Test-Path $profileDir)) {
  Write-Error "未找到 $profileDir —— 请先用 dsh --profile web 启动一次。"
  exit 1
}

$patchContent = @'
- insert:
    - id: we-sync
      name: we-sync-dsh
'@

if ($DryRun) {
  Write-Host '[dry-run] pnpm add ' $Source ' (in ' $profileDir ')'
  Write-Host '[dry-run] patch file: ' $patchFile
  Write-Host $patchContent
  exit 0
}

Write-Host "== 安装包 $Source =="
Push-Location $profileDir
try {
  pnpm add $Source
  if ($LASTEXITCODE -ne 0) { throw "pnpm add $Source 失败" }
} finally {
  Pop-Location
}

Write-Host '== 写入补丁行 =='
if (Test-Path $patchFile) {
  $existing = Get-Content $patchFile -Raw
  if ($existing -match '- id:\s*we-sync') {
    Write-Host '补丁行已存在，跳过。'
  } elseif ($existing.Trim() -eq '[]') {
    Set-Content -LiteralPath $patchFile -Value $patchContent -Encoding UTF8
    Write-Host '已写入（原文件为默认空数组）。'
  } else {
    Write-Warning '补丁文件已有其它内容，请手动追加以下片段：'
    Write-Host $patchContent
  }
} else {
  Set-Content -LiteralPath $patchFile -Value $patchContent -Encoding UTF8
  Write-Host '已创建补丁文件。'
}

Write-Host ''
Write-Host '完成！重启 dsh（web profile），打开页面即可在标签栏看到 wallpaper_share。'
Write-Host '诊断：http://127.0.0.1:3080/we-sync/diag'
