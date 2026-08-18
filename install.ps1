# we-sync 安装脚本（官方 dsh plugin 通道）
# 用法：
#   .\install.ps1                                            # 默认从 GitHub 安装
#   .\install.ps1 -Source dsh-wallpaper_share                # npm 包名（发布后）
#   .\install.ps1 -Source .\dsh-wallpaper_share-0.2.0.tgz   # 本地 tarball
# 前置：dsh 已安装；已用 dsh --profile web 启动过至少一次。
param(
  [string]$Source = 'github:YRN-playmaker/dsh-wallpaper_share',
  [string]$Profile = 'web',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if ($DryRun) {
  Write-Host "[dry-run] dsh plugin --profile $Profile add $Source"
  exit 0
}

dsh plugin --profile $Profile add $Source
if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败（exit $LASTEXITCODE）" }

Write-Host ''
Write-Host '安装完成！重启 dsh（web profile），打开页面即可看到 wallpaper_share 标签页。'
Write-Host '诊断：http://127.0.0.1:3080/we-sync/diag'
