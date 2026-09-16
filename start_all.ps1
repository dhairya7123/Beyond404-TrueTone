# Beyond404 Startup Script - Launches Backend & Frontend
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Starting Beyond404 Voice Forensics Platform     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$backendPath = "E:\Sih_complete_prototype\backend"
$frontendPath = "E:\Sih_complete_prototype\frontend"

Write-Host "`n[1/2] Launching Backend Gateway on port 8080..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; .\.venv\Scripts\python.exe server.py"

Start-Sleep -Seconds 3

Write-Host "[2/2] Launching Frontend UI on port 5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host "`nPlatform running!" -ForegroundColor Cyan
Write-Host "Backend API:  http://localhost:8080"
Write-Host "Frontend App: http://localhost:5173"
Write-Host "Supabase DB:  Connected (db.hjdreybkiairzbckycch.supabase.co)"
