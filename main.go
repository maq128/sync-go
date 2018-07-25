package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"./internal/html"
	"./internal/win32"

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
			case int:
				js += "," + strconv.Itoa(val)
			}
		}
	}
	js += ")"
	// println("callback:", js)
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

func (p *Gopher) ReadDir(path string, cb int) {
	go func() {
		fis, err := ioutil.ReadDir(path)
		if err != nil {
			p.callbackToJs(cb, err, nil)
			return
		}
		var list EntryList
		for _, fi := range fis {
			list.add(fi)
		}
		p.callbackToJs(cb, nil, list.toString())
	}()
}

func (p *Gopher) CompareFolder(a, b string, cb int) {
	go func() {
		// println("CompareFolder:", a, b, cb)
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

func (p *Gopher) copyOneFile(src, dest string) error {
	// 打开源文件
	r, err := os.Open(src)
	if err != nil {
		return err
	}
	defer r.Close()

	// 确认目标文件夹存在
	pathDest := filepath.Dir(dest)
	if _, err := os.Stat(pathDest); os.IsNotExist(err) {
		// 不存在则创建
		os.MkdirAll(pathDest, os.ModePerm)
	}

	// 打开目标文件
	w, err := os.Create(dest)
	if err != nil {
		// fmt.Println("copyOneFile: Create: err:", err)
		return err
	}
	defer w.Close()

	_, err = io.Copy(w, r)
	if err != nil {
		// fmt.Println("copyOneFile: Copy: err:", err)
		return err
	}
	return nil
}

func (p *Gopher) CopyFiles(rootSrc, rootDest, names string, cb int) {
	// println("CopyFiles:", rootSrc, rootDest, names)
	go func() {
		// 任务队列
		queue := strings.Split(names, ",")
		var total, succ, errnum int

		// 倒序
		for i := len(queue)/2 - 1; i >= 0; i-- {
			opp := len(queue) - 1 - i
			queue[i], queue[opp] = queue[opp], queue[i]
		}

		// 逐个执行
		vpath := ""
		for len(queue) > 0 {
			vpath, queue = queue[len(queue)-1], queue[:len(queue)-1]
			pathSrc := filepath.Join(rootSrc, vpath)
			fi, err := os.Stat(pathSrc)
			if err != nil {
				errnum++
				continue
			}
			if fi.IsDir() {
				// println("   +", vpath)
				// 把目录中的内容作为新任务添加到队列
				fis, err := ioutil.ReadDir(pathSrc)
				if err != nil {
					errnum++
					continue
				}
				for i := len(fis) - 1; i >= 0; i-- {
					fi := fis[i]
					queue = append(queue, filepath.Join(vpath, fi.Name()))
				}
			} else {
				// println("   -", vpath)
				// 复制文件
				wv.Dispatch(func() {
					js := fmt.Sprintf("showProgressBar(%s)", strconv.Quote("正在复制："+vpath))
					wv.Eval(js)
				})
				total++
				pathDest := filepath.Join(rootDest, vpath)
				err = p.copyOneFile(pathSrc, pathDest)
				if err != nil {
					errnum++
				} else {
					succ++

					// 设置目标文件日期与源文件相同
					os.Chtimes(pathDest, fi.ModTime(), fi.ModTime())
				}
			}
		}
		p.callbackToJs(cb, total, succ, errnum)
	}()
}

func (p *Gopher) RemoveFiles(rootDest, names string, cb int) {
	// println("RemoveFiles:", rootDest, names)
	go func() {
		// 任务队列
		queue := strings.Split(names, ",")
		var total, succ, errnum int

		// 倒序
		for i := len(queue)/2 - 1; i >= 0; i-- {
			opp := len(queue) - 1 - i
			queue[i], queue[opp] = queue[opp], queue[i]
		}

		// 逐个执行
		vpath := ""
		for len(queue) > 0 {
			vpath, queue = queue[len(queue)-1], queue[:len(queue)-1]
			fullpath := filepath.Join(rootDest, vpath)
			fi, err := os.Stat(fullpath)
			if err != nil {
				errnum++
				continue
			}
			if fi.IsDir() {
				// println("   +", vpath)
				// 把目录中的内容作为新任务添加到队列
				fis, err := ioutil.ReadDir(fullpath)
				if err != nil {
					errnum++
					continue
				}
				for i := len(fis) - 1; i >= 0; i-- {
					fi := fis[i]
					queue = append(queue, filepath.Join(vpath, fi.Name()))
				}
			} else {
				// println("   -", vpath)
				// 删除文件
				wv.Dispatch(func() {
					js := fmt.Sprintf("showProgressBar(%s)", strconv.Quote("正在删除："+vpath))
					wv.Eval(js)
				})
				total++
				err = os.Remove(fullpath)
				if err != nil {
					errnum++
				} else {
					succ++
				}
			}
		}
		p.callbackToJs(cb, total, succ, errnum)
	}()
}

func (p *Gopher) OpenWithExplorer(path string) {
	// EXPLORER.EXE /n, /e, /select, u:\working folder
	fi, err := os.Stat(path)
	if err != nil {
		return
	}
	if fi.IsDir() {
		cmd := exec.Command("explorer.exe", "/n,", "/e,", path)
		cmd.Run()
	} else {
		cmd := exec.Command("explorer.exe", "/n,", "/e,", "/select,", path)
		cmd.Run()
	}
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
