package main

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
	"math"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/html"
	"sync/win32"

	"github.com/zserge/webview"
)

type myHandler struct{}

func (h myHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	// println(req.RequestURI)
	content := html.MustAsset("html" + req.RequestURI)
	resp.Write(content)
}

var (
	wv webview.WebView
)

type Gopher struct{}

func (p *Gopher) callbackToJs(cb int, args ...interface{}) {
	js := fmt.Sprintf("_bridge.callback(%d", cb)
	for _, arg := range args {
		if arg == nil {
			js += ",null"
		} else {
			switch val := arg.(type) {
			case error:
				js += "," + strconv.Quote(val.Error())
			case string:
				js += "," + strconv.Quote(val)
			}
		}
	}
	js += ")"
	println("callback:", js)
	wv.Dispatch(func() {
		wv.Eval(js)
	})
}

func (p *Gopher) Log(str string) {
	println("[gopher]", str)
}

func (p *Gopher) ReadFile(name string, cb int) {
	go func() {
		b, err := ioutil.ReadFile(name)
		p.callbackToJs(cb, err, string(b))
	}()
}

func (p *Gopher) WriteFile(name string, content string, cb int) {
	go func() {
		err := ioutil.WriteFile(name, []byte(content), os.ModePerm)
		p.callbackToJs(cb, err)
	}()
}

func (p *Gopher) ChooseFolder(def string, cb int) {
	go func() {
		// println("ChooseFolder:", def, cb)
		dir, err := win32.ChooseFolder(def)
		p.callbackToJs(cb, err, dir)
	}()
}

func (p *Gopher) readFolder(dir string) (map[string]os.FileInfo, error) {
	list, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	mapList := make(map[string]os.FileInfo)
	for _, fi := range list {
		mapList[fi.Name()] = fi
	}
	return mapList, nil
}

type EntryList struct {
	dirs  []string
	files []string
}

func (p *EntryList) add(fi os.FileInfo) {
	if fi.IsDir() {
		p.dirs = append(p.dirs, fi.Name())
	} else {
		p.files = append(p.files, fi.Name())
	}
}

func (p *EntryList) toString() string {
	return strings.Join(p.dirs, ",") + "|" + strings.Join(p.files, ",")
}

func (p *Gopher) CompareFolder(a, b string, cb int) {
	go func() {
		println("CompareFolder:", a, b, cb)
		mapA, err := p.readFolder(a)
		if err != nil {
			p.callbackToJs(cb, err)
		}
		mapB, err := p.readFolder(b)
		if err != nil {
			p.callbackToJs(cb, err)
		}

		var aOnly, aNewer, abSame, bNewer, bOnly EntryList
		var abRecur []string

		// 遍历 A，跟 B 比较
		for name, fiA := range mapA {
			fiB := mapB[name]
			if fiB == nil {
				// 仅在 A 中存在
				aOnly.add(fiA)
			} else {
				if fiA.IsDir() && fiB.IsDir() {
					// A 和 B 中存在同名的目录
					abRecur = append(abRecur, fiA.Name())

				} else if !fiA.IsDir() && !fiB.IsDir() {
					// A 和 B 中存在同名的文件

					// 相同文件的修改时间可能存在不到 5 秒钟的误差
					diff := fiA.ModTime().Sub(fiB.ModTime()).Seconds()
					if fiA.Size() == fiB.Size() && math.Abs(diff) < 5 {
						// 相同的文件
						abSame.add(fiA)
					} else if diff > 0 {
						// A 中的文件较新
						aNewer.add(fiA)
					} else {
						// B 中的文件较新
						bNewer.add(fiB)
					}
				} else {
					// 因为类型不同（一个是文件，一个是目录），所以在 A 和 B 中都是独立的存在
					aOnly.add(fiA)
					bOnly.add(fiB)
				}

				// 清除 B 中的记录
				delete(mapB, name)
			}
		}

		// B 中剩余的
		for _, fiB := range mapB {
			bOnly.add(fiB)
		}
		p.callbackToJs(cb, err, aOnly.toString(), aNewer.toString(), abSame.toString(), bNewer.toString(), bOnly.toString(), strings.Join(abRecur, ","))
	}()
}

func main() {
	// 内建一个 web server
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	defer ln.Close()
	go func() {
		log.Fatal(http.Serve(ln, myHandler{}))
	}()

	// 打开网页
	url := "http://" + ln.Addr().String() + "/index.html"
	wv = webview.New(webview.Settings{
		Title:     "Sync",
		URL:       url,
		Width:     600,
		Height:    800,
		Resizable: true,
		ExternalInvokeCallback: func(wv webview.WebView, data string) {
			// println("onHtmlReady:", data)
			// html 已经就绪，可以植入 gopher 了
			wv.Dispatch(func() {
				wv.Bind("gopher", &Gopher{})
				wv.Eval("onGopherReady()")
			})
		},
	})
	wv.Run()
}
