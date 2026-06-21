; ILOVENAGI - personalizacion del instalador NSIS (NAGI STUDIOS)
; Reproduce la cancion de NAGI (nagi-theme.mp3) durante la instalacion.
; IMPORTANTE: extraer/reproducir en .onInit (customInit) provoca un access
; violation (0xC0000005). El unico punto seguro es customInstall (seccion).

!macro customInstall
  InitPluginsDir
  File "/oname=$PLUGINSDIR\nagi-theme.mp3" "${BUILD_RESOURCES_DIR}\nagi-theme.mp3"
  System::Call 'winmm::mciSendStringA(t "open $\"$PLUGINSDIR\nagi-theme.mp3$\" type mpegvideo alias nagibgm", t "", i 0, i 0)'
  System::Call 'winmm::mciSendStringA(t "play nagibgm repeat", t "", i 0, i 0)'
!macroend
