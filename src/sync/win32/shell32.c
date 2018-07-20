// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shbrowseforfolderw
// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/ns-shlobj_core-_browseinfow
// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shgetpathfromidlistw
// http://forums.codeguru.com/showthread.php?309472-How-to-set-default-dir-for-SHBrowseForFolder()&s=8d90ce1b0b6543496e60186816ddaf2c&p=1013331#post1013331

#include <stdio.h>
#include <wtypes.h>
#include <windows.h>
#include <Shlobj.h>
#include <locale.h>

// WCS <-- MBS
#define WCS_STRING(varname, bufsize) \
  size_t sz_##varname = 0; \
  wchar_t wcs_##varname[bufsize]; \
  errno_t err_##varname = mbstowcs_s(&sz_##varname, wcs_##varname, sizeof(wcs_##varname)/sizeof(wchar_t), varname, _TRUNCATE);

// MBS <-- WCS
#define MBS_STRING(varname, bufsize) \
  size_t sz_##varname = 0; \
  char mbs_##varname[bufsize]; \
  errno_t err_##varname = wcstombs_s(&sz_##varname, mbs_##varname, sizeof(mbs_##varname), varname, _TRUNCATE);

char *AllocMbs(LPWSTR wcs)
{
  size_t len = wcslen(wcs) * 3 + 1;
  LPSTR mbs = malloc(len);
  size_t sz = 0;
  wcstombs_s(&sz, mbs, len, wcs, _TRUNCATE);
  if (sz == 0) {
    wprintf(L"C.AllocMbs: wcstombs_s error: %d - %s\n", sz, wcs);
  }
  return mbs;
}

void FreeMbs(char *mbs)
{
  free(mbs);
}

char *chooseFolder(LPWSTR def, LPWSTR dir) {
  BROWSEINFOW bi;
  ZeroMemory(&bi, sizeof(bi));
  bi.pszDisplayName = NULL;
  bi.lpszTitle = L"请选择用于比对的目录：";
  PIDLIST_ABSOLUTE idl = SHBrowseForFolderW(&bi);
  if (idl == NULL) return NULL;
  printf("C.chooseFolder: idl: %p\n", idl);

  BOOL succ = SHGetPathFromIDListW(idl, dir);
  if (!succ) return NULL;
  wprintf(L"C.chooseFolder: succ: %d - %s\n", succ, dir);

  char * ret = AllocMbs(dir);
  printf("C.chooseFolder: ret: %s\n", ret);
  return ret;
}