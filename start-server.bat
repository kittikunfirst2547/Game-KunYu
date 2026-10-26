@echo off
chcp 65001 >nul
title Abyssal Rift Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] ไม่พบ Node.js - ติดตั้งจาก https://nodejs.org (แนะนำ 22 LTS ขึ้นไป) แล้วรันไฟล์นี้ใหม่
  pause
  exit /b 1
)
start "" http://localhost:3000
node --no-warnings server\server.js
pause
