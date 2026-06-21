@echo off
title ILOVENAGI
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Primera vez: instalando dependencias de ILOVENAGI...
  call npm install
)
echo Iniciando ILOVENAGI...
call npm start
