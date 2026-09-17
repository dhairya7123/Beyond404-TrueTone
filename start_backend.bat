@echo off
title Beyond404 Backend Server
echo ===================================================
echo   Starting Beyond404 AI Voice Forensics Server
echo ===================================================
cd /d "%~dp0backend"
"%~dp0backend\.venv\Scripts\python.exe" -u server.py
pause
