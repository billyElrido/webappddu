@echo off
title DDU Control Server
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python belum terpasang atau tidak ditemukan di PATH.
  echo Pasang Python 3, lalu jalankan file ini kembali.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8000"
python server.py
if errorlevel 1 pause
