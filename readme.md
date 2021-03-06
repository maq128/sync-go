# 功能

	对给定的两个文件夹进行比对，并对差异部分进行选择、同步。

# 开发调试

	# 安装依赖的工具和包
	go get github.com/zserge/webview
	go get github.com/jteeuwen/go-bindata/...

	# 把资源文件转换为 go 程序文件
	%userprofile%\go\bin\go-bindata -nomemcopy -pkg html -o ./src/sync-go/html/bindata.go -debug html/
	%userprofile%\go\bin\go-bindata -nomemcopy -pkg html -o ./src/sync-go/html/bindata.go html/

	# 调试运行
	go run src/sync-go/main.go

	# 打包
	go build -ldflags="-H windowsgui" sync-go
	go install -ldflags="-H windowsgui" sync-go

# 参考资料

	Tiny cross-platform webview library for C/C++/Golang
	https://github.com/zserge/webview

	converts any file into managable Go source code
	https://github.com/jteeuwen/go-bindata

	Win32 API
	https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shbrowseforfolderw
	https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/ns-shlobj_core-_browseinfow
	https://docs.microsoft.com/zh-cn/windows/desktop/api/shlobj_core/nf-shlobj_core-shgetpathfromidlistw
	http://forums.codeguru.com/showthread.php?309472-How-to-set-default-dir-for-SHBrowseForFolder()&s=8d90ce1b0b6543496e60186816ddaf2c&p=1013331#post1013331

	Get Main Wnd Handle of application
	https://stackoverflow.com/questions/6202547/win32-get-main-wnd-handle-of-application

	How do I tweak Windows Explorer to open in a directory of my choosing?
	https://www.techrepublic.com/blog/windows-and-office/how-do-i-tweak-windows-explorer-to-open-in-a-directory-of-my-choosing/
