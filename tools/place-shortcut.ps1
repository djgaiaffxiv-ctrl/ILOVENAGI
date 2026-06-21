# Crea el acceso directo de ILOVENAGI y lo coloca a la derecha del icono "MTG ADVISOR".
$ErrorActionPreference = 'Stop'

$proj    = "C:\Users\Nieves\Desktop\Claude Code\ILOVESIRI"
$electron = Join-Path $proj "node_modules\electron\dist\electron.exe"
$icon    = Join-Path $proj "build\icon.ico"
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop "ILOVENAGI.lnk"

# 1) Crear / actualizar el acceso directo
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath       = $electron
$sc.Arguments        = '.'
$sc.WorkingDirectory = $proj
$sc.IconLocation     = "$icon,0"
$sc.Description       = 'ILOVENAGI - Suite PDF sin limites'
$sc.WindowStyle      = 1
$sc.Save()
Write-Host "Acceso directo creado: $lnkPath"

# 2) Colocarlo a la derecha de MTG ADVISOR (manipulando el SysListView32 del escritorio)
Add-Type -Namespace Win -Name Desk -UsingNamespace System.Text -MemberDefinition @'
const int LVM_FIRST=0x1000;
const int LVM_GETITEMCOUNT=LVM_FIRST+4;
const int LVM_GETITEMPOSITION=LVM_FIRST+16;
const int LVM_SETITEMPOSITION=LVM_FIRST+15;
const int LVM_GETITEMTEXTW=LVM_FIRST+115;
const int LVM_GETITEMSPACING=LVM_FIRST+51;
const int GWL_STYLE=-16;
const int LVS_AUTOARRANGE=0x0100;
const uint PROCESS_VM_OPERATION=0x0008, PROCESS_VM_READ=0x0010, PROCESS_VM_WRITE=0x0020;
const uint MEM_COMMIT=0x1000, MEM_RELEASE=0x8000, PAGE_READWRITE=0x04;

[DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cl, string w);
[DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
[DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, IntPtr l);
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
[DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool inh, uint pid);
[DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr h, IntPtr a, uint sz, uint t, uint p);
[DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr h, IntPtr a, uint sz, uint t);
[DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] b, int sz, out int w);
[DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, int sz, out int r);
[DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
public delegate bool EnumProc(IntPtr h, IntPtr l);

static IntPtr FindDefView() {
  IntPtr pm = FindWindow("Progman", null);
  IntPtr dv = FindWindowEx(pm, IntPtr.Zero, "SHELLDLL_DefView", null);
  if (dv != IntPtr.Zero) return dv;
  IntPtr found = IntPtr.Zero;
  EnumWindows((h,l)=>{
    if (FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) { found = h; return false; }
    return true;
  }, IntPtr.Zero);
  return found==IntPtr.Zero ? IntPtr.Zero : FindWindowEx(found, IntPtr.Zero, "SHELLDLL_DefView", null);
}
static IntPtr GetListView() {
  IntPtr dv = FindDefView();
  if (dv==IntPtr.Zero) return IntPtr.Zero;
  return FindWindowEx(dv, IntPtr.Zero, "SysListView32", null);
}

public static string Place(string target, string move) {
  IntPtr lv = GetListView();
  if (lv==IntPtr.Zero) return "ERROR: no se encontro la vista del escritorio";
  int style = GetWindowLong(lv, GWL_STYLE);
  bool auto = (style & LVS_AUTOARRANGE)!=0;
  int count = (int)SendMessage(lv, LVM_GETITEMCOUNT, IntPtr.Zero, IntPtr.Zero);
  uint pid; GetWindowThreadProcessId(lv, out pid);
  IntPtr hp = OpenProcess(PROCESS_VM_OPERATION|PROCESS_VM_READ|PROCESS_VM_WRITE, false, pid);
  if (hp==IntPtr.Zero) return "ERROR: no se pudo abrir explorer";
  IntPtr pItem = VirtualAllocEx(hp, IntPtr.Zero, 1024, MEM_COMMIT, PAGE_READWRITE);
  IntPtr pText = VirtualAllocEx(hp, IntPtr.Zero, 1024, MEM_COMMIT, PAGE_READWRITE);
  IntPtr pPt   = VirtualAllocEx(hp, IntPtr.Zero, 16, MEM_COMMIT, PAGE_READWRITE);
  int ti=-1, mi=-1, tx=0, ty=0;
  try {
    for (int i=0;i<count;i++){
      // texto
      byte[] li = new byte[64];
      BitConverter.GetBytes((uint)1).CopyTo(li,0);          // mask = LVIF_TEXT
      BitConverter.GetBytes(pText.ToInt64()).CopyTo(li,24); // pszText
      BitConverter.GetBytes((int)256).CopyTo(li,32);        // cchTextMax
      int w; WriteProcessMemory(hp, pItem, li, li.Length, out w);
      SendMessage(lv, LVM_GETITEMTEXTW, (IntPtr)i, pItem);
      byte[] tb = new byte[512]; int r; ReadProcessMemory(hp, pText, tb, tb.Length, out r);
      string name = System.Text.Encoding.Unicode.GetString(tb);
      int z = name.IndexOf('\0'); if (z>=0) name = name.Substring(0,z);
      // posicion
      SendMessage(lv, LVM_GETITEMPOSITION, (IntPtr)i, pPt);
      byte[] pb = new byte[8]; ReadProcessMemory(hp, pPt, pb, 8, out r);
      int x = BitConverter.ToInt32(pb,0), y = BitConverter.ToInt32(pb,4);
      if (string.Equals(name, target, StringComparison.OrdinalIgnoreCase)) { ti=i; tx=x; ty=y; }
      if (string.Equals(name, move, StringComparison.OrdinalIgnoreCase)) { mi=i; }
    }
    if (ti<0) return "ERROR: no se encontro el icono '"+target+"'";
    if (mi<0) return "ERROR: no se encontro el icono '"+move+"'";
    long sp = (long)SendMessage(lv, LVM_GETITEMSPACING, IntPtr.Zero, IntPtr.Zero);
    int cx = (int)(sp & 0xFFFF);
    int nx = tx + cx, ny = ty;
    IntPtr lp = (IntPtr)(((ny & 0xFFFF) << 16) | (nx & 0xFFFF));
    SendMessage(lv, LVM_SETITEMPOSITION, (IntPtr)mi, lp);
    return (auto?"WARN_AUTOARRANGE":"OK")+"; MTG en ("+tx+","+ty+") -> ILOVENAGI en ("+nx+","+ny+"); paso="+cx;
  } finally {
    VirtualFreeEx(hp,pItem,0,MEM_RELEASE); VirtualFreeEx(hp,pText,0,MEM_RELEASE); VirtualFreeEx(hp,pPt,0,MEM_RELEASE);
    CloseHandle(hp);
  }
}
'@

# Esperar a que Explorer registre el nuevo icono y colocarlo
$result = $null
for ($try=0; $try -lt 6; $try++) {
  Start-Sleep -Milliseconds 900
  $result = [Win.Desk]::Place('MTG ADVISOR','ILOVENAGI')
  if ($result -notmatch "no se encontro el icono 'ILOVENAGI'") { break }
}
Write-Host "POSICION: $result"
