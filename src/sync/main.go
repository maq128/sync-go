package main

//
// https://github.com/zserge/webview
// https://github.com/jteeuwen/go-bindata
//
// %userprofile%\go\bin\go-bindata -nomemcopy -pkg html -o ./src/sync/html/bindata.go -debug html/
// %userprofile%\go\bin\go-bindata -nomemcopy -pkg html -o ./src/sync/html/bindata.go html/
// go run src/sync/main.go
// go build -ldflags="-H windowsgui" src/sync/main.go
//

import (
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"strconv"
	"sync/html"
	"sync/win32"
	"time"

	"github.com/zserge/webview"
)

type myHandler struct{}

func (h myHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	// println(req.RequestURI)
	content := html.MustAsset("html" + req.RequestURI)
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

func (p *Gopher) ChooseFolder(def string, cb int) {
	go func() {
		println("ChooseFolder:", def, cb)
		dir, err := win32.ChooseFolder(def)
		p.callbackToJs(cb, err, dir)
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
