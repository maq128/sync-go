// jQuery 文档: http://api.jquery.com/
// Promise 文档: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
// 三态复选框: https://css-tricks.com/indeterminate-checkboxes/
// Flex 布局教程: http://www.ruanyifeng.com/blog/2015/07/flex-examples.html

_bridge = {
	cbs: {},
	seq: 1
};
_bridge.registerCallback = function(cb) {
	var id = this.seq ++;
	this.cbs[id] = cb;
	return id;
};
_bridge.callback = function() {
	var args = Array.prototype.slice.call(arguments);
	var id = args.shift();
	var cb = this.cbs[id];
	if (!cb) return;
	delete this.cbs[id];
	cb.apply(null, args);
};
_bridge.bind = function(name) {
	return function() {
		var args = Array.prototype.slice.call(arguments);
		var cb = args.pop();
		if (cb !== undefined) {
			// 如果最后一个入口参数是 function 则作为 callback
			if (typeof cb == 'function') {
				cb = _bridge.registerCallback(cb);
			}
			args.push(cb);
		}
		gopher[name].apply(gopher, args);
	};
};

fs = {
	readFile: _bridge.bind('readFile'),
	chooseFolder: _bridge.bind('chooseFolder')
};

$(function() {
	window.external.invoke("html is ready.");
});

function onGopherReady() {
	setup();
	loadConfig();
}

var CONFIG_FILE = './sync-go.cfg';
var PATH_SEP = '\\';
var config = null;
var pair = null;

$.fn.tabview = function(act) {
	var me = this;
	if (!me.data('is-tabview')) {
		me.data('is-tabview', true);

		me.children('li.tab').each(function() {
			var target = $('#' + $(this).attr('data-target'));
			if ($(this).is('.cur')) {
				target.css('display', 'block');
			} else {
				target.css('display', 'none');
			}
		});

		me.delegate('li.tab', 'click', function() {
			var name = $(this).attr('data-target');
			$.fn.tabview.show.call(me, name);
		});
	}

	if (act == 'show' && typeof(arguments[1]) == 'string') {
		$.fn.tabview.show.call(me, arguments[1]);
	}

	return me;
};
$.fn.tabview.show = function(name) {
	this.children('li.tab').each(function() {
		var tab = $(this);
		var targetName = tab.attr('data-target');
		var target = $('#' + targetName);
		if (targetName == name) {
			tab.addClass('cur');
			target.css('display', 'block');
		} else {
			tab.removeClass('cur');
			target.css('display', 'none');
		}
	});
};

function setup() {
	// CONFIG_FILE = nw.App.dataPath + PATH_SEP + 'sync-nw.cfg';

	$('#tabview').tabview();
	$('.panel .btn').prop('disabled', true);

	// // 设置右键菜单
	// var cm = new nw.Menu();
	// cm.append(new nw.MenuItem({
	// 	label: '打开 A 目录...',
	// 	click: function() {
	// 		nw.Shell.showItemInFolder(pair.dir_a + PATH_SEP + getPath(cm.current_node));
	// 	}
	// }));
	// cm.append(new nw.MenuItem({
	// 	label: '打开 B 目录...',
	// 	click: function() {
	// 		nw.Shell.showItemInFolder(pair.dir_b + PATH_SEP + getPath(cm.current_node));
	// 	}
	// }));
	// $('.tree').delegate('.title', 'contextmenu', function(evt) {
	// 	cm.current_node = $(evt.target).parent('.node');
	// 	cm.items[0].enabled = (evt.delegateTarget.id != 'tree-b-only');
	// 	cm.items[1].enabled = (evt.delegateTarget.id != 'tree-a-only');
	// 	cm.popup(evt.pageX, evt.pageY);
	// 	return false;
	// });
	// $('body').on('contextmenu', function(evt) {
	// 	return false;
	// });

	// 选择目录 A
	$('#file_a').change(function() {
		$('#tabview').tabview('show', 'panel-home');
		var dir = $(this).val();
		if (dir == '') return;
		pair.dir_a = dir;
		$('#dir_a').val(pair.dir_a);
		$(this).attr('nwworkingdir', pair.dir_a);
		config.pairs[0] = pair;
		saveConfig();
	});

	// 选择目录 B
	$('#file_b').change(function() {
		$('#tabview').tabview('show', 'panel-home');
		var dir = $(this).val();
		if (dir == '') return;
		pair.dir_b = dir;
		$('#dir_b').val(pair.dir_b);
		$(this).attr('nwworkingdir', pair.dir_b);
		config.pairs[0] = pair;
		saveConfig();
	});
	$('#file_a').click(function() {
		fs.chooseFolder($('#dir_a').val(), function(err, path) {
			alert(err + ':' + path);
		});
	});
	$('#file_b').click(function() {
		fs.chooseFolder($('#dir_b').val(), function(err, path) {
			alert(err + ':' + path);
		});
	});

	// 点击比对按钮
	$('#btn-compare').click(onCompare);

	// 点击操作按钮
	$('.toolbar').delegate('.btn', 'click', onBtnClick);

	// 点击 checkbox（勾选文件）
	$('.tree').delegate('.node .cb', 'change', onCheckboxChange);

	// 点击 title（展开/折叠目录）
	$('.tree').delegate('.node.dir .title', 'click', onTitleClick);
}

function loadConfig() {
	fs.readFile(CONFIG_FILE, function(err, data) {
		if (!err) {
			try {
				config = JSON.parse(data);
			} catch (e) {}
		}
		config = config || {};
		config.pairs = config.pairs || [];
		pair = config.pairs[0] || {
			dir_a: 'C:\\',
			dir_b: 'C:\\'
		};

		$('#dir_a').val(pair.dir_a);
		$('#file_a').attr('nwworkingdir', pair.dir_a);
		$('#dir_b').val(pair.dir_b);
		$('#file_b').attr('nwworkingdir', pair.dir_b);
	});
}

function saveConfig() {
	fs.writeFile(CONFIG_FILE, JSON.stringify(config, undefined, '\t'), function (err) {
		if (err) {
			alert(err);
		}
	});
}

function numberWithComma(n) {
	var n = '' + n;
	var sep = '';
	var str = ' 字节';
	while (n.length > 0) {
		str = n.substr(-3) + sep + str;
		sep = ',';
		n = n.substr(0, n.length - 3);
	}
	return str;
}

function VNodeItem(name, stats) {
	this.name = name;

	if (stats) {
		this.isDirectory = stats.isDirectory();
	} else {
		this.isDirectory = true;
		if (stats === undefined) {
			this.isRoot = true;
		}
	}

	if (this.isDirectory) {
		this.subdirs = [];
		this.files = [];
		this.isLoaded = false;
	} else {
		this.mtime = stats.mtime.getTime();
		this.size = stats.size;
	}
}

VNodeItem.prototype.isEmpty = function() {
	return this.isDirectory && this.isLoaded && this.subdirs.length == 0 && this.files.length == 0;
}

VNodeItem.prototype.add = function(item) {
	if (!this.isDirectory) return;
	if (item.isDirectory) {
		this.subdirs.push(item);
	} else {
		this.files.push(item);
	}
};

VNodeItem.prototype.finish = function() {
	this.isLoaded = true;
};

VNodeItem.prototype.dumpTo = function(div) {
	$(div).text(JSON.stringify(this, undefined, '  ')).css('white-space', 'pre');
};

VNodeItem.prototype.renderTo = function(div, expand, checked, disabled) {
	if (this.isDirectory) {
		var cb = $('<input type="checkbox">').addClass('cb').prop('checked', !!checked).prop('disabled', !!disabled);
		var title = $('<div></div>').addClass('title').text(this.name);
		var dir = $('<div></div>').addClass('node dir').append(cb).append(title).appendTo(div);
		if (this.isRoot) {
			dir.addClass('root');
		}

		var subs = $('<div></div>').addClass('dir-subs');
		if (this.isEmpty()) {
			subs.html('<span style="color:#808080">&nbsp;&nbsp;&lt;空&gt;</span>');
		} else {
			this.subdirs.forEach(function(dir) {
				dir.renderTo(subs, false);
			});
			this.files.forEach(function(file) {
				file.renderTo(subs, false);
			});
		}
		subs.appendTo(div);

		if (this.isLoaded) {
			if (expand) {
				dir.addClass('expanded');
				subs.css('display', 'block');
			} else {
				subs.css('display', 'none');
			}
		} else {
			dir.addClass('waiting');
			subs.css('display', 'none');
		}

		// 建立 handle-target 联系
		dir.data('target-div', subs);
		subs.data('handle-div', dir);

		return title;
	} else {
		var cb = $('<input type="checkbox">').addClass('cb').prop('checked', !!checked).prop('disabled', !!disabled);
		var title = $('<div></div>').addClass('title').text(this.name);
		var file = $('<div></div>').addClass('node file').append(cb).append(title).appendTo(div);
		return title;
	}
};

function readDir(dir, success, failure) {
	fs.readdir(dir, function(err, names) {
		if (err) return failure(err);
		var files = {};
		var one = function() {
			var name = names.shift();
			if (!name) {
				success(files);
				return;
			}
			var fullpath = dir + PATH_SEP + name;
			fs.lstat(fullpath, function(err, stats) {
				if (!err) {
					files[name] = new VNodeItem(name, stats);
				}
				setTimeout(one, 0);
			});
		};
		one();
	});
}

function getPath(handle) {
	var segs = [];
	if (!handle.is('.root')) {
		segs.push($(handle).children('.title').text());
	}
	$(handle).parents('.dir-subs').each(function() {
		var handle = $(this).data('handle-div');
		if (handle.is('.root')) return;
		segs.push($(handle).children('.title').text());
	});
	return segs.reverse().join(PATH_SEP);
}

function showProgressBar(html) {
	var mask = $('#progress-mask');
	if (!html) {
		mask.css('display', 'none').children('.msg').html('');
		return;
	}
	mask.css('display', 'flex').children('.msg').html(html);
}

function DirRunner(dir_a, dir_b) {
	this.dir_a = dir_a;
	this.dir_b = dir_b;
	this.sofar = 0;
	this.total = 0;
	this.error = 0;
}

DirRunner.prototype.progress = function(html) {
	if (html === undefined) {
		html = '目录总数：' + this.total + '<br>比对完成：' + this.sofar;
		if (this.error > 0) {
			html += '<br>错误数：' + this.error;
		}
	}
	showProgressBar(html);
};

DirRunner.prototype.compare = function() {
	var me = this;
	$('#btn-compare').prop('disabled', true);

	var aOnly = new VNodeItem('[A]');
	var aNewer = new VNodeItem('[A > B]');
	var abSame = new VNodeItem('[A = B]');
	var bNewer = new VNodeItem('[A < B]');
	var bOnly = new VNodeItem('[B]');

	me.recursiveCompare('', aOnly, aNewer, abSame, bNewer, bOnly, function(err) {
		// 大量渲染可能造成长时间卡顿，所以先显示提示然后再渲染
		me.progress('比对完成，正在处理显示，请稍候 ...');
		setTimeout(function() {
			aOnly.renderTo($('#tree-a-only').empty().data('root', me.dir_a), true);
			aNewer.renderTo($('#tree-a-newer').empty().data('root', me.dir_a), true);
			abSame.renderTo($('#tree-ab-same').empty().data('root', me.dir_a), true);
			bNewer.renderTo($('#tree-b-newer').empty().data('root', me.dir_b), true);
			bOnly.renderTo($('#tree-b-only').empty().data('root', me.dir_b), true);

			//aNewer.dumpTo($('#dump'));

			$('#btn-compare').prop('disabled', false);
			$('.panel .btn').prop('disabled', true);
			me.progress(false);

			$('#tabview').tabview('show', 'panel-a-newer');
		}, 0);
	});
};

DirRunner.prototype.recursiveCompare = function(vpath, aOnly, aNewer, abSame, bNewer, bOnly, finish) {
	var me = this;
	me.total ++;

	var p1 = new Promise(function(resolve, reject) {
		readDir(me.dir_a + PATH_SEP + vpath, resolve, reject);
	});
	var p2 = new Promise(function(resolve, reject) {
		readDir(me.dir_b + PATH_SEP + vpath, resolve, reject);
	});

	Promise.all([p1, p2]).then(function(results) {
		var a_items = results[0];
		var b_items = results[1];
		var more = [];

		// 遍历 A，跟 B 比较
		Object.keys(a_items).forEach(function(name) {
			var item_a = a_items[name];
			var item_b = b_items[name];
			if (!item_b) {
				// 仅在 A 中存在
				aOnly.add(item_a);
			} else {
				if (item_a.isDirectory === item_b.isDirectory) {
					if (item_a.isDirectory) {
						// A 和 B 中存在同名的目录

						// 递归深入比对
						var subdir = vpath + PATH_SEP + name;
						var subdir_aOnly = new VNodeItem(name, false);
						var subdir_aNewer = new VNodeItem(name, false);
						var subdir_abSame = new VNodeItem(name, false);
						var subdir_bNewer = new VNodeItem(name, false);
						var subdir_bOnly = new VNodeItem(name, false);
						var p = new Promise(function(resolve, reject) {
							me.recursiveCompare(subdir, subdir_aOnly, subdir_aNewer, subdir_abSame, subdir_bNewer, subdir_bOnly, function(err) {
								if (!err) {
									subdir_aOnly.isEmpty() || aOnly.add(subdir_aOnly);
									subdir_aNewer.isEmpty() || aNewer.add(subdir_aNewer);
									subdir_abSame.isEmpty() || abSame.add(subdir_abSame);
									subdir_bNewer.isEmpty() || bNewer.add(subdir_bNewer);
									subdir_bOnly.isEmpty() || bOnly.add(subdir_bOnly);
								}

								resolve();
							});
						});
						more.push(p);

					} else {
						// A 和 B 中存在同名的文件

						// 相同文件的修改时间可能存在不到 5 秒钟的误差
						if (item_a.mtime + 5000 > item_b.mtime && item_a.mtime < item_b.mtime + 5000 && item_a.size == item_b.size) {
							// 相同的文件
							abSame.add(item_a);
						} else {
							if (item_a.mtime > item_b.mtime) {
								// A 中的文件较新
								aNewer.add(item_a);
							} else {
								// B 中的文件较新
								bNewer.add(item_b);
							}
						}
					}
				} else {
					// 因为类型不同（一个是文件，一个是目录），所以在 A 和 B 中都是独立的存在
					aOnly.add(item_a);
					bOnly.add(item_b);
				}

				// 清除 B 中的记录
				delete b_items[name];
			}
		});

		// B 中剩余的
		Object.keys(b_items).forEach(function(name) {
			// 仅在 B 中存在
			var item_b = b_items[name];
			bOnly.add(item_b);
		});

		Promise.all(more).then(function() {
			aOnly.finish();
			aNewer.finish();
			abSame.finish();
			bNewer.finish();
			bOnly.finish();
			me.sofar ++;
			me.progress();
			finish();
		});
	}).catch(function(err) {
		me.error ++;
		me.sofar ++;
		me.progress();
		finish(err);
	});
};

function FilesMan(dir_src, dir_dest, queue) {
	this.dir_src = dir_src;
	this.dir_dest = dir_dest;
	this.queue = queue;
	this.sofar = 0;
	this.total = queue.length;
	this.error = 0;

	this.copy_path = null;
	this.copy_total = 0;
	this.copy_sofar = 0;
}

FilesMan.prototype.progress = function(html) {
	if (html === undefined) {
		html = '文件总数：' + this.total + '<br>成功完成：' + this.sofar;
		if (this.error > 0) {
			html += '<br>错误数：' + this.error;
		}

		// 仅在“复制”过程中用到
		if (this.copy_path) {
			html += '<br>正在复制：' + this.copy_path;
		}
		if (this.copy_sofar > 0) {
			html += '<br><br>文件大小：' + numberWithComma(this.copy_total);
			html += '<br>已经复制：' + numberWithComma(this.copy_sofar);
		}
	}
	showProgressBar(html);
};

FilesMan.prototype.mkdirp = function(fullpath, finish) {
	var me = this;
	// 先尝试创建指定目录
	fs.mkdir(fullpath, function(err) {
		if (err && err.code == 'ENOENT') {
			// 若失败原因是“父目录不存在”，则递归创建父目录
			me.mkdirp(path.dirname(fullpath), function(err) {
				// 然后再次尝试创建指定目录
				fs.mkdir(fullpath, finish);
			});
			return;
		}
		finish(err);
	});
};

FilesMan.prototype.copy = function() {
	var me = this;

	// 取出一项
	var vpath = me.queue.shift();
	if (!vpath) {
		me.progress();
		alert('复制完成。');
		me.progress(false);
		return;
	}

	// 确保接力过程仅被调用一次
	var relayOnce = function(err) {
		err && me.error ++;
		setTimeout(function() {
			me.copy();
		}, 0);
		relayOnce = $.noop;
	};

	var from = me.dir_src + PATH_SEP + vpath;
	var to = me.dir_dest + PATH_SEP + vpath;

	me.copy_path = vpath;
	me.copy_total = me.copy_sofar = 0;
	me.progress();

	fs.lstat(from, function(err, stats) {
		if (err) return relayOnce(err);

		if (stats.isDirectory()) {
			me.total --;
			// 如果是目录项，则把其中的子目录和文件添加到任务列表
			fs.readdir(from, function(err, files) {
				if (err) return relayOnce(err);

				for (var i=0; i < files.length; i++) {
					me.queue.push(vpath + PATH_SEP + files[i]);
					me.total ++;
				}
				relayOnce();
			});
		} else {
			// 如果是文件项，则复制
			me.copy_total = stats.size;
			var rs = fs.createReadStream(from);
			rs.on('open', function() {
				// 确保目标目录存在，不存在则创建
				me.mkdirp(path.dirname(to), function(err) {
					if (err && err.code != 'EEXIST') {
						rs.destroy();
						relayOnce(err);
						return;
					}
					var ws = fs.createWriteStream(to);
					ws.on('open', function() {
						rs.pipe(ws).on('finish', function() {
							// 设置目标文件的时间戳（延迟一点时间是为了避免最终的 mtime 变成当前时间）
							setTimeout(function() {
								fs.utimes(to, stats.atime, stats.mtime, function(err) {
									me.sofar ++;
									relayOnce(err);
								});
							}, 1);
						}).on('error', function() {
							rs.destroy();
							ws.destroy();
							relayOnce(true);
						});
					}).on('drain', function() {
						me.copy_sofar = ws.bytesWritten;
						me.progress();
					}).on('error', function() {
						rs.destroy();
						relayOnce(true);
					});
				});
			}).on('error', function() {
				relayOnce(true);
			});
		}
	});
};

FilesMan.prototype.delete = function() {
	var me = this;

	// 取出一项
	var vpath = me.queue.shift();
	if (!vpath) {
		me.progress();
		alert('删除完成。');
		me.progress(false);
		return;
	}

	// 确保接力过程仅被调用一次
	var relayOnce = function(err) {
		err && me.error ++;
		setTimeout(function() {
			me.delete();
		}, 0);
		relayOnce = $.noop;
	};

	var from = me.dir_src + PATH_SEP + vpath;

	me.progress('正在删除 ' + from);

	fs.lstat(from, function(err, stats) {
		if (err) return relayOnce(err);

		if (stats.isDirectory()) {
			me.total --;
			// 如果是目录项，则把其中的子目录和文件添加到任务列表
			fs.readdir(from, function(err, files) {
				if (err) return relayOnce(err);

				for (var i=0; i < files.length; i++) {
					me.queue.push(vpath + PATH_SEP + files[i]);
					me.total ++;
				}
				relayOnce();
			});
		} else {
			// 如果是文件项，则删除它
			fs.unlink(from, function(err) {
				me.sofar ++;
				relayOnce(err);
			});
		}
	});
};

function onCompare() {
	new DirRunner(pair.dir_a, pair.dir_b).compare();
}

function onBtnClick() {
	var btn = $(this);

	// 找出所有需要处理的文件（以及尚未递归遍历的目录）
	var queue = [];
	btn.parents('.panel').find('.node').each(function() {
		var node = $(this);
		if (node.is('.dir') && !node.is('.waiting')) return;
		var checked = node.children('.cb').prop('checked');
		if (!checked) return;
		queue.push(getPath(node));
	});

	var lock = false;

	if (btn.is('.btn-copy-a2b')) {
		var fm = new FilesMan(pair.dir_a, pair.dir_b, queue);
		fm.copy();
		lock = true;
	} else if (btn.is('.btn-copy-b2a')) {
		var fm = new FilesMan(pair.dir_b, pair.dir_a, queue);
		fm.copy();
		lock = true;
	} else if (btn.is('.btn-delete-a')) {
		if (confirm('确定要删除选中的文件吗？\r\n这些文件仅在 A 目录中存在！')) {
			var fm = new FilesMan(pair.dir_a, pair.dir_a, queue);
			fm.delete();
			lock = true;
		}
	} else if (btn.is('.btn-delete-b')) {
		if (confirm('确定要删除选中的文件吗？\r\n这些文件仅在 B 目录中存在！')) {
			var fm = new FilesMan(pair.dir_b, pair.dir_b, queue);
			fm.delete();
			lock = true;
		}
	}

	if (lock) {
		// 禁用所有 checkbox
		btn.parents('.panel').find('.cb').prop('disabled', true);

		// 禁用本 panel 里的操作按钮
		btn.parents('.panel').find('.btn').prop('disabled', true);
	}
}

function onCheckboxChange() {
	var handle = $(this).parent();
	var overall_checked = $(this).prop('checked');

	$(this).prop('indeterminate', false);

	// 设置下游所有 checkbox 的勾选状态与本节点相同
	if (handle.is('.dir')) {
		handle.data('target-div').find('.node .cb')
			.prop('checked', overall_checked)
			.prop('indeterminate', false);
	}

	// 更新上游所有 checkbox 的勾选状态
	handle = handle.parent('.dir-subs').data('handle-div');
	while (handle && handle.length > 0) {
		var checked = 0;
		var unchecked = 0;
		var indeterminate = false;
		var target = handle.data('target-div');
		target.children('.node').each(function() {
			var cb = $(this).children('.cb');
			if (cb.prop('checked')) {
				checked ++;
				if (cb.prop('indeterminate')) {
					indeterminate = true;
				}
			} else {
				unchecked ++;
			}
		});
		handle.children('.cb').prop('checked', checked > 0).prop('indeterminate', indeterminate || (checked > 0 && unchecked > 0));
		overall_checked = (checked > 0);

		// 上溯
		handle = handle.parent('.dir-subs').data('handle-div');
	}

	// 如果有选中项，则按钮可以点击
	$(this).parents('.panel').find('.btn').prop('disabled', !overall_checked);
}

function onTitleClick() {
	var handle = $(this).parent();
	if (handle.is('.root')) return;

	var target = handle.data('target-div');
	if (handle.is('.expanded')) {
		target.css('display', 'none');
		handle.removeClass('expanded');
	} else {
		target.css('display', 'block');
		handle.addClass('expanded');

		// 如果尚未加载
		if (handle.is('.waiting')) {
			handle.removeClass('waiting');
			target.html('<span style="color:#808080">&nbsp;&nbsp;正在加载……</span>');

			var checked = handle.children('.cb').prop('checked');
			var disabled = handle.children('.cb').prop('disabled');

			new Promise(function(resolve, reject) {
				var vpath = getPath(handle);
				var root = handle.parents('.tree').data('root');
				readDir(root + PATH_SEP + vpath, resolve, reject);
			}).then(function(items) {
				target.empty();
				var names = Object.keys(items);
				names.forEach(function(name) {
					var item = items[name];
					item.renderTo(target, true, checked, disabled);
				});
				if (names.length == 0) {
					target.html('<span style="color:#808080">&nbsp;&nbsp;&lt;空&gt;</span>');
				}
			}).catch(function(err) {
				alert(err);
			});
		}
	}
}
