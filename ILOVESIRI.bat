@echo off
title ILOVESIRI
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Primera vez: instalando dependencias de ILOVESIRI...
  call npm install
)
echo Iniciando ILOVESIRI...
call npm start
