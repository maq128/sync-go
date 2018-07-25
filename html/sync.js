// jQuery 文档: http://api.jquery.com/
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
_bridge.bindWithCallback = function(name) {
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

native = {
	readFile: _bridge.bindWithCallback('readFile'),
	writeFile: _bridge.bindWithCallback('writeFile'),
	chooseFolder: _bridge.bindWithCallback('chooseFolder'),
	compareFolder: _bridge.bindWithCallback('compareFolder'),
	readDir: _bridge.bindWithCallback('readDir'),
	copyFiles: _bridge.bindWithCallback('copyFiles'),
	removeFiles: _bridge.bindWithCallback('removeFiles'),
};

$(function() {
	window.external.invoke("html is ready.");
});

function onGopherReady() {
	setup();
	loadConfig();
}

var PATH_SEP = '\\';
var CONFIG_FILE = './sync-go.cfg';
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
$.fn.popup = function(act) {
	var me = this;
	if (!me.data('is-popup')) {
		me.data('is-popup', true);

		me.hide();

		$('body').click(function(evt) {
			me.hide();
			if ($(evt.target).is('#menuitem-a')) {
				var vpath = me.data('vpath');
				gopher.openWithExplorer(config.pairs[0].dir_a + PATH_SEP + vpath)
			} else if ($(evt.target).is('#menuitem-b')) {
				var vpath = me.data('vpath');
				gopher.openWithExplorer(config.pairs[0].dir_b + PATH_SEP + vpath)
			}
		});
	}

	if (act == 'show') {
		$.fn.popup.show.call(me, arguments[1]);
	}

	return me;
};
$.fn.popup.show = function(evt) {
	var me = this;
	var handle = $(evt.target).parent('.node');
	if (!handle.is('.node') || !(vpath = getPath(handle))) {
		me.hide();
		return;
	}
	var treeId = $(evt.target).parents('.tree').attr('id');
	var hasA = ['tree-a-only', 'tree-a-newer', 'tree-ab-same', 'tree-b-newer'].indexOf(treeId) >= 0;
	var hasB = ['tree-b-only', 'tree-a-newer', 'tree-ab-same', 'tree-b-newer'].indexOf(treeId) >= 0;
	me.css('left', evt.pageX + 5).css('top', evt.pageY);
	me.data('vpath', vpath);
	me.children('#menuitem-a')[hasA ? 'removeClass' : 'addClass']('disabled');
	me.children('#menuitem-b')[hasB ? 'removeClass' : 'addClass']('disabled');
	me.show();
};

function showProgressBar(msg) {
	var mask = $('#progress-mask');
	if (!msg) {
		mask.css('display', 'none').children('.msg').text('');
		return;
	}
	mask.css('display', 'flex').children('.msg').text(msg);
}

function setup() {
	$('#tabview').tabview();
	$('.panel .btn').prop('disabled', true);

	$('#popup-menu').popup();
	$('body').on('contextmenu', function(evt) {
		$('#popup-menu').popup('show', evt);
		return false;
	});

	// 选择目录 A
	$('#file_a').click(function() {
		native.chooseFolder($('#dir_a').val(), function(err, dir) {
			if (err) return;
			pair.dir_a = dir;
			$('#dir_a').val(pair.dir_a);
			config.pairs[0] = pair;
			saveConfig();
		});
	});

	// 选择目录 B
	$('#file_b').click(function() {
		native.chooseFolder($('#dir_b').val(), function(err, dir) {
			if (err) return;
			pair.dir_b = dir;
			$('#dir_b').val(pair.dir_b);
			config.pairs[0] = pair;
			saveConfig();
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
	native.readFile(CONFIG_FILE, function(err, data) {
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
	native.writeFile(CONFIG_FILE, JSON.stringify(config, undefined, '\t'), function (err) {
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

function VNodeItem(name, isFile) {
	this.name = name;

	if (isFile === undefined) {
		this.isRoot = true;
	}
	this.isDirectory = !isFile;
	if (this.isDirectory) {
		this.subdirs = [];
		this.files = [];
		this.isLoaded = false;
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
}

VNodeItem.prototype.parseChildren = function(str) {
	var sa = str.split('|', 2);
	var dirs = sa[0].split(',');
	while (dir = dirs.shift()) {
		this.add(new VNodeItem(dir, false));
	}
	var files = sa[1].split(',');
	while (file = files.shift()) {
		this.add(new VNodeItem(file, true));
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

function DirRunner(dir_a, dir_b) {
	this.dir_a = dir_a;
	this.dir_b = dir_b;
	this.sofar = 0;
	this.total = 0;
	this.error = 0;
}

DirRunner.prototype.compare = function() {
	var me = this;
	$('#btn-compare').prop('disabled', true);
	showProgressBar('开始比对 ...');

	var aOnly = new VNodeItem('[A]');
	var aNewer = new VNodeItem('[A > B]');
	var abSame = new VNodeItem('[A = B]');
	var bNewer = new VNodeItem('[A < B]');
	var bOnly = new VNodeItem('[B]');

	me.recursiveCompare('', aOnly, aNewer, abSame, bNewer, bOnly, function(err) {
		// 大量渲染可能造成长时间卡顿，所以先显示提示然后再渲染
		showProgressBar('比对完成，正在处理显示，请稍候 ...');
		setTimeout(function() {
			aOnly.renderTo($('#tree-a-only').empty().data('root', me.dir_a), true);
			aNewer.renderTo($('#tree-a-newer').empty().data('root', me.dir_a), true);
			abSame.renderTo($('#tree-ab-same').empty().data('root', me.dir_a), true);
			bNewer.renderTo($('#tree-b-newer').empty().data('root', me.dir_b), true);
			bOnly.renderTo($('#tree-b-only').empty().data('root', me.dir_b), true);

			//aNewer.dumpTo($('#dump'));

			$('#btn-compare').prop('disabled', false);
			$('.panel .btn').prop('disabled', true);
			showProgressBar(false);

			$('#tabview').tabview('show', 'panel-a-newer');
		}, 0);
	});
};

DirRunner.prototype.recursiveCompare = function(vpath, aOnly, aNewer, abSame, bNewer, bOnly, finish) {
	var me = this;
	me.total ++;

	var pathA = this.dir_a + PATH_SEP + vpath;
	var pathB = this.dir_b + PATH_SEP + vpath;
	native.compareFolder(pathA, pathB, function(err, aOnlyStr, aNewerStr, abSameStr, bNewerStr, bOnlyStr, abRecurStr) {
		if (err) me.error ++;

		aOnly.parseChildren(aOnlyStr);
		aNewer.parseChildren(aNewerStr);
		abSame.parseChildren(abSameStr);
		bNewer.parseChildren(bNewerStr);
		bOnly.parseChildren(bOnlyStr);

		var abRecur = abRecurStr.split(',');
		var recurOne = function() {
			var subname = abRecur.shift();
			if (!subname) {
				aOnly.finish();
				aNewer.finish();
				abSame.finish();
				bNewer.finish();
				bOnly.finish();
				me.sofar ++;

				var msg = '正在比对：' + me.sofar + ' / ' + me.total;
				if (this.error > 0) {
					msg += ' - 错误数：' + me.error;
				}
				showProgressBar(msg);

				finish();
				return;
			}

			var subdir = vpath + PATH_SEP + subname;
			var subdir_aOnly = new VNodeItem(subname, false);
			var subdir_aNewer = new VNodeItem(subname, false);
			var subdir_abSame = new VNodeItem(subname, false);
			var subdir_bNewer = new VNodeItem(subname, false);
			var subdir_bOnly = new VNodeItem(subname, false);
			me.recursiveCompare(subdir, subdir_aOnly, subdir_aNewer, subdir_abSame, subdir_bNewer, subdir_bOnly, function(err) {
				if (!err) {
					subdir_aOnly.isEmpty() || aOnly.add(subdir_aOnly);
					subdir_aNewer.isEmpty() || aNewer.add(subdir_aNewer);
					subdir_abSame.isEmpty() || abSame.add(subdir_abSame);
					subdir_bNewer.isEmpty() || bNewer.add(subdir_bNewer);
					subdir_bOnly.isEmpty() || bOnly.add(subdir_bOnly);
				}
				setTimeout(recurOne, 0);
			});
		};
		recurOne();
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
		native.copyFiles(pair.dir_a, pair.dir_b, queue.join(','), function(total, succ, error) {
			showProgressBar(false);
			var msg = '复制完成：';
			msg += '\n文件总数：' + total;
			msg += '\n成功复制：' + succ;
			msg += '\n错误数：' + error;
			alert(msg);
		});
		lock = true;
	} else if (btn.is('.btn-copy-b2a')) {
		native.copyFiles(pair.dir_b, pair.dir_a, queue.join(','), function(total, succ, error) {
			showProgressBar(false);
			var msg = '复制完成：';
			msg += '\n文件总数：' + total;
			msg += '\n成功复制：' + succ;
			msg += '\n错误数：' + error;
			alert(msg);
		});
		lock = true;
	} else if (btn.is('.btn-delete-a')) {
		if (confirm('确定要删除选中的文件吗？\r\n这些文件仅在 A 目录中存在！')) {
			native.removeFiles(pair.dir_a, queue.join(','), function(total, succ, error) {
				showProgressBar(false);
				var msg = '删除完成：';
				msg += '\n文件总数：' + total;
				msg += '\n成功删除：' + succ;
				msg += '\n错误数：' + error;
				alert(msg);
			});
			lock = true;
		}
	} else if (btn.is('.btn-delete-b')) {
		if (confirm('确定要删除选中的文件吗？\r\n这些文件仅在 B 目录中存在！')) {
			native.removeFiles(pair.dir_b, queue.join(','), function(total, succ, error) {
				showProgressBar(false);
				var msg = '删除完成：';
				msg += '\n文件总数：' + total;
				msg += '\n成功删除：' + succ;
				msg += '\n错误数：' + error;
				alert(msg);
			});
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

			var vpath = getPath(handle);
			var root = handle.parents('.tree').data('root');
			native.readDir(root + PATH_SEP + vpath, function(err, str) {
				target.empty();
				var dummy = new VNodeItem('-', false);
				dummy.parseChildren(str);
				dummy.subdirs.forEach(function(sub) {
					sub.renderTo(target, true, checked, disabled);
				});
				dummy.files.forEach(function(sub) {
					sub.renderTo(target, true, checked, disabled);
				});
			});
		}
	}
}
