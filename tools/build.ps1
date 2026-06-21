# Construye el instalable NSIS. Pensado para ejecutarse ELEVADO (permite crear symlinks de winCodeSign).
Set-Location 'C:\Users\Nieves\Desktop\Claude Code\ILOVESIRI'
$log = 'C:\Users\Nieves\Desktop\Claude Code\ILOVESIRI\dist-build.log'
Remove-Item $log -ErrorAction SilentlyContinue
& npx.cmd electron-builder --win nsis *>&1 | Out-File -Encoding utf8 $log
"DONE_EXIT_$LASTEXITCODE" | Out-File -Append -Encoding utf8 $log
