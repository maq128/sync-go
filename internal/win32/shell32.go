package win32

/*
#cgo windows CFLAGS: -DWIN64 -DNDEBUG
#cgo windows LDFLAGS: -lshell32 -lkernel32

#include <wtypes.h>
long ChooseFolder(LPWSTR def, LPWSTR dir);
*/
import "C"

import (
	"errors"
	_ "runtime/cgo"
	"syscall"
	"unsafe"
)

func ChooseFolder(def string) (dir string, err error) {
	wcsDef, _ := syscall.UTF16FromString(def)
	buf := make([]uint16, C.MAX_PATH)
	ret := C.ChooseFolder(C.LPWSTR(unsafe.Pointer(&wcsDef[0])), C.LPWSTR(unsafe.Pointer(&buf[0])))
	if ret <= 0 {
		return "", errors.New("Cancel")
	}
	dir = syscall.UTF16ToString(buf)
	return dir, nil
}
