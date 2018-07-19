package main

//
// https://github.com/zserge/webview
// https://github.com/jteeuwen/go-bindata
//
// %userprofile%\go\bin\go-bindata -nomemcopy html/
// go run main.go bindata.go
// go build -ldflags="-H windowsgui"
//

import (
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"strconv"
	"syscall"
	"time"
	"unsafe"

	"github.com/zserge/webview"
)

type myHandler struct{}

func (h myHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	// println(req.RequestURI)
	content := MustAsset("html" + req.RequestURI)
	resp.Write(content)
}

type Gopher struct{}

func (p *Gopher) callbackToJs(cb int, args ...interface{}) {
	js := fmt.Sprintf("_bridge.callback(%d", cb)
	for _, arg := range args {
		if arg == nil {
			js += ", null"
		} else {
			// switch val := arg.(type) {
			// case error:
			// 	js += ", '" + strconv.Quote(val.Error()) + "'"
			// case string:
			// 	js += ", " + strconv.Quote(val)
			// }
			if err, ok := arg.(error); ok {
				js += ", '" + strconv.Quote(err.Error()) + "'"
			} else if str, ok := arg.(string); ok {
				js += ", " + strconv.Quote(str)
			}
		}
	}
	js += ")"
	println("callback:", js)
	wv.Dispatch(func() {
		wv.Eval(js)
	})
}

func (p *Gopher) ReadFile(name string, cb int) {
	go func() {
		b, err := ioutil.ReadFile(name)
		p.callbackToJs(cb, err, string(b))
	}()
}

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
	MAX_PATH = 260
)

var (
	modshell32              = syscall.NewLazyDLL("shell32.dll")
	procSHBrowseForFolder   = modshell32.NewProc("SHBrowseForFolderW")
	procSHGetPathFromIDList = modshell32.NewProc("SHGetPathFromIDListW")
)

func (p *Gopher) ChooseFolder(def string, cb int) {
	go func() {
		println("ChooseFolder:", def, cb)
		var bi BROWSEINFO

		var DisplayName [MAX_PATH]uint16
		DisplayName[0] = 'D'
		DisplayName[1] = ':'
		DisplayName[2] = '\\'
		bi.DisplayName = &DisplayName[0]

		Title := syscall.StringToUTF16("请选择用于比对的目录：")
		bi.Title = &Title[0]

		bi.Flags = 0x00000001 | 0x00000002 | 0x00000008 | 0x00000010 | 0x00000040 | 0x00000200

		idl, _, _ := procSHBrowseForFolder.Call(uintptr(unsafe.Pointer(&bi)))
		fmt.Println("ChooseFolder:", idl)

		if idl == 0 {
			p.callbackToJs(cb, "Cancel", "")
			return
		}

		buf := make([]uint16, MAX_PATH)
		procSHGetPathFromIDList.Call(idl, uintptr(unsafe.Pointer(&buf[0])))
		p.callbackToJs(cb, nil, syscall.UTF16ToString(buf))
		// println(syscall.UTF16ToString(bi.DisplayName))
	}()
}

var wv webview.WebView

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	defer ln.Close()
	go func() {
		// Set up your http server here
		log.Fatal(http.Serve(ln, myHandler{}))
	}()

	url := "http://" + ln.Addr().String() + "/index.html"
	// webview.Open("Sync", url, 600, 800, true)
	wv = webview.New(webview.Settings{
		Title:     "Sync",
		URL:       url,
		Width:     600,
		Height:    800,
		Resizable: true,
	})

	go func() {
		time.Sleep(time.Millisecond * 100)
		wv.Dispatch(func() {
			wv.Bind("gopher", &Gopher{})
		})
	}()

	wv.Run()
}
