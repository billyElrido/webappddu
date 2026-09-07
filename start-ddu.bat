@echo off
title DDU Control Server
cd /d "%~dp0"
set "NODE_EXE=node"
set "NPM_CMD=npm"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
  ) else (
    echo Node.js belum terpasang atau tidak ditemukan di PATH.
    echo Pasang Node.js 20 LTS, lalu jalankan file ini kembali.
    pause
    exit /b 1
  )
)
if not exist node_modules (
  echo Memasang dependency Node.js...
  call "%NPM_CMD%" install
  if errorlevel 1 pause & exit /b 1
)
if not exist ".env" (
  echo Konfigurasi MySQL belum tersedia.
  echo Salin .env.example menjadi .env lalu isi kredensial MySQL lokal.
  pause
  exit /b 1
)
set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
netstat -ano | findstr /R /C:"127.0.0.1:3306 .*LISTENING" >nul
if errorlevel 1 (
  if not exist "%MYSQL_EXE%" (
    echo MySQL Server lokal tidak ditemukan.
    echo Pasang MySQL 8.4 atau sesuaikan MYSQL_EXE di start-ddu.bat.
    pause
    exit /b 1
  )
  echo Menjalankan MySQL lokal...
  powershell -NoProfile -Command "Start-Process -FilePath '%MYSQL_EXE%' -ArgumentList '--defaults-file=mysql-local.ini' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
  timeout /t 3 /nobreak >nul
)
start "" "http://127.0.0.1:8000"
"%NODE_EXE%" --env-file=.env server.js
if errorlevel 1 pause
