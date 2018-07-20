package win32

/*
#cgo windows CFLAGS: -DWIN64 -DNDEBUG
#cgo windows LDFLAGS: -lshell32

#include <wtypes.h>
char *AllocMbs(LPCWSTR wcs);
void FreeMbs(char *mbs);
char *chooseFolder(LPWSTR def, LPWSTR dir);
*/
import "C"

import (
	"errors"
	"fmt"
	_ "runtime/cgo"
	"syscall"
	"unsafe"
)

// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shbrowseforfolderw
// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/ns-shlobj_core-_browseinfow
// https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shgetpathfromidlistw
// http://forums.codeguru.com/showthread.php?309472-How-to-set-default-dir-for-SHBrowseForFolder()&s=8d90ce1b0b6543496e60186816ddaf2c&p=1013331#post1013331
type BROWSEINFO struct {
	Owner        uintptr // HWND
	Root         *uint16 // PCIDLIST_ABSOLUTE
	DisplayName  *uint16 // LPWSTR
	Title        *uint16 // LPCWSTR
	Flags        uint32  // UINT
	CallbackFunc uintptr // BFFCALLBACK
	LParam       uintptr // LPARAM
	Image        int32   // int
}

const (
	MAX_PATH          = 260
	BFFM_INITIALIZED  = uint32(1)
	BFFM_SELCHANGED   = uint32(2)
	BFFM_SETSELECTION = uintptr(0x0400 + 102) // (WM_USER + 102)
)

var (
	shell32                 = syscall.MustLoadDLL("shell32.dll")
	procSHBrowseForFolder   = shell32.MustFindProc("SHBrowseForFolderW")
	procSHGetPathFromIDList = shell32.MustFindProc("SHGetPathFromIDListW")

	user32          = syscall.MustLoadDLL("user32.dll")
	procSendMessage = user32.MustFindProc("SendMessageW")
)

func bffCallbackProc(hwnd uintptr, uMsg uint32, lParam uintptr, lpData uintptr) uintptr {
	println("bffCallbackProc:", uMsg)
	if uMsg == BFFM_INITIALIZED {
		if lpData != 0 {
			println("sendMessage:", hwnd, BFFM_SETSELECTION, uintptr(0xffffffffffffffff), lpData)
			// procSendMessage.Call(hwnd, BFFM_SETSELECTION, 0xffffffffffffffff, lpData)
		}
	}
	return 0
}

func ChooseFolder(def string) (dir string, err error) {
	array_def, _ := syscall.UTF16FromString(def)
	LPWSTR_def := C.LPWSTR(unsafe.Pointer(&array_def[0]))
	buf := make([]uint16, MAX_PATH)
	mbsDir := C.chooseFolder(LPWSTR_def, C.LPWSTR(unsafe.Pointer(&buf[0])))
	if uintptr(unsafe.Pointer(mbsDir)) == 0 {
		return "", errors.New("Cancel")
	}
	dir = syscall.UTF16ToString(buf)
	// dir = C.GoString(mbsDir)
	C.FreeMbs(mbsDir)
	return dir, nil
}

func xChooseFolder(def string) (dir string, err error) {
	var bi BROWSEINFO

	var DisplayName [MAX_PATH]uint16
	DisplayName[0] = 'D'
	DisplayName[1] = ':'
	DisplayName[2] = '\\'
	bi.DisplayName = &DisplayName[0]

	Title, _ := syscall.UTF16FromString("请选择用于比对的目录：")
	bi.Title = &Title[0]

	bi.Flags = 0x00000001 | 0x00000002 | 0x00000008 | 0x00000010 | 0x00000040 | 0x00000200

	bi.CallbackFunc = syscall.NewCallback(bffCallbackProc)

	var DefPath [MAX_PATH]uint16
	DefPath[0] = 'D'
	DefPath[1] = ':'
	DefPath[2] = '\\'
	bi.LParam = uintptr(unsafe.Pointer(&DefPath[0]))
	bi.Image = 4

	idl, _, _ := procSHBrowseForFolder.Call(uintptr(unsafe.Pointer(&bi)))
	fmt.Println("ChooseFolder:", idl)

	if idl == 0 {
		return "", errors.New("Cancel")
	}

	buf := make([]uint16, MAX_PATH)
	procSHGetPathFromIDList.Call(idl, uintptr(unsafe.Pointer(&buf[0])))

	dir = syscall.UTF16ToString(buf)
	return dir, nil
}
