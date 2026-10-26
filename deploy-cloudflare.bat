@echo off
chcp 65001 >nul
title Abyssal Rift - Deploy to Cloudflare Workers
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] ไม่พบ Node.js - ติดตั้งจาก https://nodejs.org ^(22 LTS ขึ้นไป^) แล้วรันไฟล์นี้ใหม่
  pause
  exit /b 1
)

echo.
echo [1/2] ล็อกอิน Cloudflare (จะเปิดเบราว์เซอร์ให้กด Allow - ครั้งแรกครั้งเดียว)
call npx --yes wrangler@4 whoami >nul 2>nul
if errorlevel 1 call npx --yes wrangler@4 login

echo.
echo [2/2] อัปโหลดเกมขึ้น Cloudflare Workers ...
echo       (ครั้งแรก: ถ้าถามชื่อ workers.dev subdomain ให้พิมพ์ชื่อที่ต้องการแล้วกด Enter)
call npx --yes wrangler@4 deploy
if errorlevel 1 (
  echo.
  echo [!] Deploy ไม่สำเร็จ - ส่งข้อความด้านบนมาให้ Claude ดูได้เลย
  pause
  exit /b 1
)
echo.
echo  ===============================================================
echo   เสร็จแล้ว! ลิงก์เกมคือบรรทัดที่ลงท้ายด้วย .workers.dev ด้านบน
echo   ลิงก์นี้ถาวร ไม่ต้องเปิดคอมทิ้งไว้  แก้เกมแล้วรันไฟล์นี้ใหม่เพื่ออัปเดต
echo  ===============================================================
pause
