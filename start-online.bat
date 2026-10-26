@echo off
chcp 65001 >nul
title Abyssal Rift - Online (Cloudflare Tunnel)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] ไม่พบ Node.js - ติดตั้งจาก https://nodejs.org ^(22 LTS ขึ้นไป^) แล้วรันไฟล์นี้ใหม่
  pause
  exit /b 1
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo [i] ไม่พบ cloudflared - กำลังติดตั้งด้วย winget ...
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  echo.
  echo [i] ติดตั้งเสร็จแล้ว ปิดหน้าต่างนี้แล้วดับเบิลคลิก start-online.bat ใหม่อีกครั้ง
  pause
  exit /b 0
)

echo [1/2] เปิดเซิร์ฟเวอร์เกม (หน้าต่างใหม่)...
start "Abyssal Rift Server" cmd /k node --no-warnings server\server.js
timeout /t 3 /nobreak >nul

echo [2/2] เปิด Cloudflare Tunnel...
echo.
echo  ===============================================================
echo   รอสักครู่ จะมีลิงก์  https://xxxx-xxxx.trycloudflare.com
echo   ขึ้นในกรอบด้านล่าง  ส่งลิงก์นั้นให้เพื่อนเปิดเล่นได้เลย
echo   (ลิงก์เปลี่ยนใหม่ทุกครั้งที่เปิด - ปิดหน้าต่างนี้ = ปิดลิงก์)
echo  ===============================================================
echo.
cloudflared tunnel --no-autoupdate --url http://localhost:3000
pause
