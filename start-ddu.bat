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
set "DDU_PORT=8000"
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if /I "%%A"=="DDU_PORT" set "DDU_PORT=%%B"
)
set "APP_URL=http://127.0.0.1:%DDU_PORT%"
set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
set "MYSQLADMIN_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqladmin.exe"
set "MYSQL_INI=%~dp0mysql-local.ini"
if not exist "%MYSQL_EXE%" (
  echo MySQL Server lokal tidak ditemukan.
  echo Pasang MySQL 8.4 atau sesuaikan MYSQL_EXE di start-ddu.bat.
  pause
  exit /b 1
)
if not exist "%MYSQLADMIN_EXE%" (
  echo Alat pemeriksa MySQL tidak ditemukan: mysqladmin.exe
  pause
  exit /b 1
)
if not exist "%MYSQL_INI%" (
  echo Konfigurasi MySQL lokal tidak ditemukan: mysql-local.ini
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $health=Invoke-RestMethod -Uri '%APP_URL%/api/health' -TimeoutSec 3; if ($health.ok) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo DDU Control sudah berjalan di %APP_URL%.
  start "" "%APP_URL%"
  exit /b 0
)

"%MYSQLADMIN_EXE%" --defaults-file="%MYSQL_INI%" ping --silent >nul 2>nul
if errorlevel 1 (
  netstat -ano | findstr /R /C:"127.0.0.1:3306 .*LISTENING" >nul
  if not errorlevel 1 (
    echo Port 3306 sedang dipakai, tetapi MySQL DDU tidak merespons.
    echo Tutup aplikasi database lain yang memakai port 3306 lalu coba kembali.
    pause
    exit /b 1
  )
  echo Menjalankan MySQL lokal...
  powershell -NoProfile -Command "Start-Process -FilePath '%MYSQL_EXE%' -ArgumentList '--defaults-file=mysql-local.ini' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
)

echo Menunggu MySQL siap...
set "MYSQL_READY=0"
for /L %%I in (1,1,45) do (
  "%MYSQLADMIN_EXE%" --defaults-file="%MYSQL_INI%" ping --silent >nul 2>nul
  if not errorlevel 1 (
    set "MYSQL_READY=1"
    goto mysql_ready
  )
  timeout /t 1 /nobreak >nul
)
:mysql_ready
if "%MYSQL_READY%"=="0" (
  echo MySQL tidak siap setelah 45 detik.
  echo Periksa berkas log pada folder mysql-data atau konfigurasi mysql-local.ini.
  pause
  exit /b 1
)
echo MySQL siap di 127.0.0.1:3306.

start "" powershell -NoProfile -WindowStyle Hidden -Command "$deadline=(Get-Date).AddSeconds(45); do { try { $health=Invoke-RestMethod -Uri '%APP_URL%/api/health' -TimeoutSec 2; if ($health.ok) { Start-Process '%APP_URL%'; exit 0 } } catch {}; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"
"%NODE_EXE%" --env-file=.env server.js
if errorlevel 1 pause
