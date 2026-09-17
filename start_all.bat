@echo off
title Beyond404 System Launcher
echo ===================================================
echo   Launching Backend Server and Cloudflare Tunnel
echo ===================================================
start "Beyond404 Backend" "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
start "Beyond404 Cloudflare Tunnel" "%~dp0start_tunnel.bat"
echo.
echo [OK] Both processes launched in separate windows!
echo Check the Cloudflare Tunnel window for your public https://...trycloudflare.com URL.
echo.
pause
