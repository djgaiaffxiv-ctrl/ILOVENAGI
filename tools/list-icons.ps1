# Lista nombre + posicion de cada icono del escritorio (para comprobar solapamientos).
Add-Type -Namespace Win -Name Desk2 -UsingNamespace System.Text -MemberDefinition @'
const int LVM_FIRST=0x1000;
const int LVM_GETITEMCOUNT=LVM_FIRST+4;
const int LVM_GETITEMPOSITION=LVM_FIRST+16;
const int LVM_GETITEMTEXTW=LVM_FIRST+115;
const uint PVO=0x0008, PVR=0x0010, PVW=0x0020, MEM_COMMIT=0x1000, MEM_RELEASE=0x8000, PAGE_RW=0x04;
[DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cl, string w);
[DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
[DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, IntPtr l);
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
[DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr h, IntPtr a, uint sz, uint t, uint p);
[DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr h, IntPtr a, uint sz, uint t);
[DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr h, IntPtr a, byte[] b, int sz, out int w);
[DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, int sz, out int r);
[DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
public delegate bool EnumProc(IntPtr h, IntPtr l);
static IntPtr LV(){
  IntPtr pm=FindWindow("Progman",null);
  IntPtr dv=FindWindowEx(pm,IntPtr.Zero,"SHELLDLL_DefView",null);
  if(dv==IntPtr.Zero){ IntPtr f=IntPtr.Zero; EnumWindows((h,l)=>{ if(FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null)!=IntPtr.Zero){f=h;return false;} return true;},IntPtr.Zero); if(f!=IntPtr.Zero) dv=FindWindowEx(f,IntPtr.Zero,"SHELLDLL_DefView",null); }
  return FindWindowEx(dv,IntPtr.Zero,"SysListView32",null);
}
public static string List(){
  IntPtr lv=LV(); if(lv==IntPtr.Zero) return "ERR";
  int n=(int)SendMessage(lv,LVM_GETITEMCOUNT,IntPtr.Zero,IntPtr.Zero);
  uint pid; GetWindowThreadProcessId(lv,out pid);
  IntPtr hp=OpenProcess(PVO|PVR|PVW,false,pid);
  IntPtr pI=VirtualAllocEx(hp,IntPtr.Zero,1024,MEM_COMMIT,PAGE_RW);
  IntPtr pT=VirtualAllocEx(hp,IntPtr.Zero,1024,MEM_COMMIT,PAGE_RW);
  IntPtr pP=VirtualAllocEx(hp,IntPtr.Zero,16,MEM_COMMIT,PAGE_RW);
  var sb=new System.Text.StringBuilder();
  for(int i=0;i<n;i++){
    byte[] li=new byte[64]; BitConverter.GetBytes((uint)1).CopyTo(li,0); BitConverter.GetBytes(pT.ToInt64()).CopyTo(li,24); BitConverter.GetBytes((int)256).CopyTo(li,32);
    int w; WriteProcessMemory(hp,pI,li,li.Length,out w);
    SendMessage(lv,LVM_GETITEMTEXTW,(IntPtr)i,pI);
    byte[] tb=new byte[512]; int r; ReadProcessMemory(hp,pT,tb,512,out r);
    string nm=System.Text.Encoding.Unicode.GetString(tb); int z=nm.IndexOf('\0'); if(z>=0) nm=nm.Substring(0,z);
    SendMessage(lv,LVM_GETITEMPOSITION,(IntPtr)i,pP);
    byte[] pb=new byte[8]; ReadProcessMemory(hp,pP,pb,8,out r);
    sb.AppendLine(BitConverter.ToInt32(pb,0)+"\t"+BitConverter.ToInt32(pb,4)+"\t"+nm);
  }
  VirtualFreeEx(hp,pI,0,MEM_RELEASE); VirtualFreeEx(hp,pT,0,MEM_RELEASE); VirtualFreeEx(hp,pP,0,MEM_RELEASE); CloseHandle(hp);
  return sb.ToString();
}
'@
Write-Host ("x`ty`tnombre")
Write-Host ([Win.Desk2]::List())
