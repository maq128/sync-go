#include <stdio.h>
#include <wtypes.h>
#include <windows.h>
#include <Shlobj.h>
#include <locale.h>

int bffCallbackProc(HWND hwnd, UINT uMsg, LPARAM lParam, LPARAM lpData) {
  switch (uMsg) {
  case BFFM_INITIALIZED:
    // printf("bffCallbackProc: BFFM_INITIALIZED: lpData: %S\n", lpData);
    if (lpData)
      SendMessageA(hwnd, BFFM_SETSELECTION, TRUE, lpData); // 没有起到作用？
    break;
  case BFFM_SELCHANGED:
    // printf("bffCallbackProc: BFFM_SELCHANGED: %d\n", sizeof(wchar_t));
    // unsigned short buf[MAX_PATH];
    // BOOL succ = SHGetPathFromIDListW((PCIDLIST_ABSOLUTE)lParam, buf);
    // if (succ) {
    //   printf("bffCallbackProc: BFFM_SELCHANGED: %ls\n", buf);
    // }
    break;
  case BFFM_VALIDATEFAILED:
    // printf("bffCallbackProc: BFFM_VALIDATEFAILED\n");
    break;
  default:
    break;
  }
  return 0;
}

long ChooseFolder(LPWSTR def, LPWSTR dir) {
  setlocale(LC_ALL, ""); // 让 printf 能够正确输出 WCS

  BROWSEINFOW bi;
  ZeroMemory(&bi, sizeof(bi));
  bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_EDITBOX | BIF_NEWDIALOGSTYLE | BIF_NONEWFOLDERBUTTON;
  bi.pszDisplayName = NULL;
  bi.lpszTitle = L"请选择用于比对的目录：";
  bi.lpfn = bffCallbackProc;
  bi.lParam = (LPARAM)def; // 没有起到作用？

  PIDLIST_ABSOLUTE pidl = SHBrowseForFolderW(&bi);
  if (pidl == NULL) return 0;
  // printf("C.chooseFolder: pidl: %p\n", pidl);

  BOOL succ = SHGetPathFromIDListW(pidl, dir);
  if (!succ) return 0;
  // printf("C.chooseFolder: succ: %d - %ls\n", succ, dir);

  return wcslen(dir);
}
