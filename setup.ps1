# One-time setup: create the GitHub repo, push, and turn on GitHub Pages.
# Run: right-click > Run with PowerShell, or:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$repo = "gym-log-pwa"
Set-Location $PSScriptRoot
Start-Transcript -Path (Join-Path $PSScriptRoot "setup-log.txt") -Force | Out-Null

function Finish($code) {
  Stop-Transcript | Out-Null
  Write-Host ""
  Read-Host "Press Enter to close"
  exit $code
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "ERROR: Git is not installed. Run: winget install Git.Git" -ForegroundColor Red; Finish 1 }
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) { $env:Path += ";C:\Program Files\GitHub CLI" }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host "ERROR: GitHub CLI not found." -ForegroundColor Red; Finish 1 }

$login = (gh api user --jq ".login" 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $login) { Write-Host "ERROR: gh is not logged in. Run: gh auth login" -ForegroundColor Red; Write-Host $login; Finish 1 }
$id = (gh api user --jq ".id" | Out-String).Trim()
$email = "$id+$login@users.noreply.github.com"
Write-Host "GitHub user: $login"
Write-Host "Commits will use your private email: $email"

if (-not (Test-Path ".git")) { git init -b main | Out-Host }
git config user.email $email
git config user.name  $login

git add . | Out-Host
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Initial PWA" | Out-Host }

cmd /c "gh repo view $login/$repo >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public --source . --remote origin --push 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: could not create the repo." -ForegroundColor Red; Finish 1 }
} else {
  git remote get-url origin 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { git remote add origin "https://github.com/$login/$repo.git" }
  git push -u origin main 2>&1 | Out-Host
}

cmd /c "gh api -X POST repos/$login/$repo/pages -f source[branch]=main -f source[path]=/ >nul 2>nul"
if ($LASTEXITCODE -eq 0) { Write-Host "GitHub Pages turned on." } else { Write-Host "(GitHub Pages may already be on)" }

Write-Host ""
Write-Host "DONE. In about a minute the app will be at:" -ForegroundColor Green
Write-Host "  https://$login.github.io/$repo/" -ForegroundColor Green
Write-Host "Repo: https://github.com/$login/$repo"
Finish 0
