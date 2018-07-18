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
	"log"
	"net"
	"net/http"

	"github.com/zserge/webview"
)

type myHandler struct{}

func (h myHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	// println(req.RequestURI)
	myHTML := MustAsset("html" + req.RequestURI)
	resp.Write(myHTML)
}

type fs struct {
	Counter int `json:"counter"`
}

func (p *fs) ReadFile(p1 string, p2 int) {
	println("fs.readFile", p1, p2)
	p.Counter = 9
}

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
	w := webview.New(webview.Settings{
		Title:     "Sync",
		URL:       url,
		Width:     600,
		Height:    800,
		Resizable: true,
	})
	w.Dispatch(func() {
		w.Bind("gofs", &fs{3})
	})
	w.Run()
}
