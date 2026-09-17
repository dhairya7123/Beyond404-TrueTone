@echo off
title Cloudflare Tunnel for Beyond404
echo ===================================================
echo   Starting Cloudflare Tunnel for http://localhost:8080
echo ===================================================
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080
pause
