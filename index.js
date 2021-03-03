



import { customAlphabet  } from 'https://cdn.skypack.dev/nanoid';
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);

function getCookieValue(a) {
	var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)')
  
	return b ? b.pop() : ''
}

const deta = window.Deta(getCookieValue("pk"));
const db = deta.Base('nullboard');

var nb_codeVersion = 20200429;
var nb_dataVersion = 20190412;

//
if (typeof (localStorage) === "undefined") {
	alert('Hmmm... no "localStorage" support');
}

/*
 *	poor man's error handling -- $fixme
 */
window.onerror = function (message, file, line, col, e) {
	var cb1;
	alert("Error occurred: " + e.message);
	return false;
};

window.addEventListener("error", function (e) {
	var cb2;
	alert("Error occurred: " + e.error.message);
	return false;
})

/*
 *
 */
function Note(text) {
	this.text = text;
	this.raw = false;
	this.min = false;
}

function List(title) {
	this.title = title;
	this.notes = [];

	this.addNote = function (text) {
		var x = new Note(text);
		this.notes.push(x);
		return x;
	}
}

function Board(title) {
	this.format = nb_dataVersion;
	this.id = nanoid(7);
	this.revision = 1;
	this.title = title;
	this.lists = [];

	this.addList = function (title) {
		var x = new List(title);
		this.lists.push(x);
		return x;
	}
}

//
function htmlEncode(raw) {
	return $('tt .encoder').text(raw).html();
}

function htmlDecode(enc) {
	return $('tt .encoder').html(enc).text();
}

//
function setText($note, text) {
	$note.attr('_text', text);

	text = htmlEncode(text);
	console.log(text);
	var hmmm = /\b(https?:\/\/[^\s]+)/mg;

	text = text.replace(hmmm, function (url) {
		return '<a href="' + url + '" target=_blank>' + url + '</a>';
	});
	
	$note.html(text);
}

function getText($note) {
	return $note.attr('_text');
}

//
function updatePageTitle() {
	if (!document.board) {
		document.title = 'Nullboard';
		return;
	}

	var $text = $('.wrap .board > .head .text');
	var title = getText($text);

	document.board.title = title;
	document.title = 'NB - ' + (title || '(unnamed board)');
}

function updateUndoRedo() {
	var $undo = $('.board .menu .undo-board');
	var $redo = $('.board .menu .redo-board');

	var undo = false;
	var redo = false;

	if (document.board) {
		var history = document.board.history;
		var rev = document.board.revision;

		undo = (rev != history[history.length - 1]);
		redo = (rev != history[0]);
	}

	if (undo) $undo.show(); else $undo.hide();
	if (redo) $redo.show(); else $redo.hide();
}

//
function showBoard(quick) {
	var board = document.board;

	var $wrap = $('.wrap');
	var $bdiv = $('tt .board');
	var $ldiv = $('tt .list');
	var $ndiv = $('tt .note');

	var $b = $bdiv.clone();
	var $b_lists = $b.find('.lists');

	$b[0].board_id = board.id;
	console.log(board);
	setText($b.find('.head .text'), board.title);


	board.lists.forEach(function (list) {

		var $l = $ldiv.clone();
		var $l_notes = $l.find('.notes');

		setText($l.find('.head .text'), list.title);

		list.notes.forEach(function (n) {
			var $n = $ndiv.clone();
			setText($n.find('.text'), n.text);
			if (n.raw) $n.addClass('raw');
			if (n.min) $n.addClass('collapsed');
			$l_notes.append($n);
		});

		$b_lists.append($l);
	});

	if (quick)
		$wrap.html('').append($b);
	else
		$wrap.html('')
			.css({ opacity: 0 })
			.append($b)
			.animate({ opacity: 1 });

	updatePageTitle();
	updateUndoRedo();
	updateBoardIndex();
	setupListScrolling();
}

//
function saveBoard() {
	var $board = $('.wrap .board');
	var board = new Board(getText($board.find('> .head .text')));

	$board.find('.list').each(function () {
		var $list = $(this);
		var l = board.addList(getText($list.find('.head .text')));

		$list.find('.note').each(function () {
			var $note = $(this)
			var n = l.addNote(getText($note.find('.text')));
			n.raw = $note.hasClass('raw');
			n.min = $note.hasClass('collapsed');
		});
	});

	//
	var rev_new = document.board.history[0] + 1;
	var rev_old = document.board.revision;

	document.board.revision = rev_new;

	board.id = document.board.id;
	board.revision = document.board.revision;

	var blob_id = board.id + '.' + board.revision;
	

	localStorage.setItem('nullboard.board.' + blob_id, JSON.stringify(board));
	localStorage.setItem('nullboard.board.' + board.id, board.revision);
	board.revision = 1;
	db.put({key: board.id, value:  JSON.stringify(board)}).then(data=> {
		console.log(data);
	})
	board.revision = rev_new;
	console.log('Saved nullboard.board.' + blob_id + ' of ' + board.title);

	//
	trimBoardHistory(rev_old, rev_new, 50);

	updateUndoRedo();
	updateBoardIndex();
}

function parseBoard(blob) {

	var board;

	try {
		board = JSON.parse(blob);
	}
	catch (x) {
		console.log(blob)
		console.log('Malformed JSON');
		return false;
	}

	if (typeof board.format === 'undefined') {
		console.log("Format shit undefined")
		console.log('Board.format is missing');
		return false;
	}

	if (board.format != nb_dataVersion) {
		console.log("dsta")
		console.log('Board.format is wrong', board.format, nb_dataVersion);
		return false;
	}

	if (!board.revision) {
		
		console.log("revsisi")

		console.log("Board.revision is missing");
		return false;
	}

	return $.extend(new Board, board);
}
async function getStuff(key) {
	db.get(key).then(data => {
		return data.value;
	}).catch(err => {
		return err;
	})
}
function loadBoard(board_id) {

	var revision;
		var blob;
		var board;

		revision = localStorage.getItem('nullboard.board.' + board_id);
		if (! revision)
			return false;

		blob = localStorage.getItem('nullboard.board.' + board_id + '.' + revision);
		if (! blob)
			return false;

		board = parseBoard(blob);
		if (! board)
		{
			alert('Whoops. Error parsing board data.');
			console.log('Whoops, there it is:', blob);
			return false;
		}

		if (board.id != board_id || board.revision != revision)
		{
			alert('Whoops. Malformed board.');
			console.log('Whoops, there it is:', board.id, board_id, board.revision, revision);
			return false;
		}

		board.history = loadBoardHistory(board.id);

	return board;
	// var revision;
	// var blob;
	// var board;
	// revision = localStorage.getItem('nullboard.board.' + board_id);


	// if (!revision)
	// 	return false;
	
	// var res; 
	// db.get(board_id).then(data => {
	// 	blob = data;
	// 	if (!blob) {
	// 		console.log(blob)
	// 		return false;
	// 	}
	
	// 	board = parseBoard(blob.value);
	
	// 	if (!board) {
	// 		console("Not board")
	// 		alert('Whoops. Error parsing board data.');
	// 		console.log('Whoops, there it is:', blob);
	// 		return false;
	// 	}
	
	// 	if (board.id != board_id || board.revision != revision) {
	// 		console("Jank")
	// 		alert('Whoops. Malformed board.');
	// 		console.log('Whoops, there it is:', board.id, board_id, board.revision, revision);
	// 		return false;
	// 	}
	// 	console.log(board);
	// 	board.history = loadBoardHistory(board.id);
	// 	res = board;
	// }).catch(err => {
	// 	res = false;
	// })
	// console.log(res);
	// return res;
		
}

//
function loadBoardHistory(board_id) {
	var re = new RegExp('^nullboard\.board\.' + board_id + '\.(\\d+)$');
	var r = [];

	for (var i = 0; i < localStorage.length; i++) {
		var m = localStorage.key(i).match(re);
		if (m) r.push(parseInt(m[1]));
	}

	r.sort(function (a, b) { return b - a; });
	return r;
}

function trimBoardHistory(rev_old, rev_new, max_revs) {
	var hist_1 = document.board.history;
	var hist_2 = []
	var k = 'nullboard.board.' + document.board.id + '.';

	for (var i = 0; i < hist_1.length; i++) {
		var rev = hist_1[i];
		if (rev_old < rev && rev < rev_new)
			nukeBoardRevision(rev);
		else
			hist_2.push(rev);
	}
	for (var i = max_revs; i < hist_2.length; i++)
		nukeBoardRevision(hist_2[i]);

	document.board.history = loadBoardHistory(document.board.id);
}

//
function nukeBoardRevision(rev) {
	var k = 'nullboard.board.' + document.board.id + '.' + rev;
	localStorage.removeItem(k);
	console.log("Removed " + k);
}

function nukeBoard() {
	var prefix = new RegExp('^nullboard\.board\.' + document.board.id);

	for (var i = 0; i < localStorage.length;) {
		var k = localStorage.key(i);
		if (k.match(prefix)) {
			console.log("Removed " + k);
			localStorage.removeItem(k);
		}
		else {
			i++;
		}
	}

	localStorage.removeItem('nullboard.last_board');
}

//
function importBoard(blob) {
	var board = parseBoard(blob);
	if (!board) {
		alert("This doesn't appear to be a valid Nullboard board export");
		return false;
	}

	if (!confirm('Import board called "' + board.title + '", internal ID of [' + board.id + '] ?'))
		return false;

	board.id = nanoid(7);
	var blob_id = board.id + '.' + board.revision;

	localStorage.setItem('nullboard.board.' + blob_id, JSON.stringify(board));
	localStorage.setItem('nullboard.board.' + board.id, board.revision);
	db.put({key: board.id, value:  JSON.stringify(board)}).then(data=> {
		console.log(data);
	})

	openBoard(board.id);
}

//
function createDemoBoard() {
	var blob =
		'{"format":20190412,"id":1555071015420,"revision":581,"title":"Welcome to Nullboard","lists":[{"title":"The Use' +
		'r Manual","notes":[{"text":"This is a note.\\nA column of notes is a list.\\nA set of lists is a board.","raw"' +
		':false,"min":false},{"text":"All data is saved locally.\\nThe whole thing works completely offline.","raw":fal' +
		'se,"min":false},{"text":"Last 50 board revisions are retained.","raw":false,"min":false},{"text":"Ctrl-Z is Un' +
		'do  -  goes one revision back.\\nCtrl-Y is Redo  -  goes one revision forward.","raw":false,"min":false},{"tex' +
		't":"Caveats","raw":true,"min":false},{"text":"Desktop-oriented.\\nMobile support is basically untested.","raw"' +
		':false,"min":false},{"text":"Works in Firefox, Chrome is supported.\\nShould work in Safari, may work in Edge.' +
		'","raw":false,"min":false},{"text":"Still very much in beta. Caveat emptor.","raw":false,"min":false},{"text":' +
		'"Issues and suggestions","raw":true,"min":false},{"text":"Post them on Github.\\nSee \\"Nullboard\\" at the to' +
		'p left for the link.","raw":false,"min":false}]},{"title":"Things to try","notes":[{"text":"\u2022   Click on ' +
		'a note to edit.","raw":false,"min":false},{"text":"\u2022   Click outside of it when done editing.\\n\u2022   ' +
		'Alternatively, use Shift-Enter.","raw":false,"min":false},{"text":"\u2022   To discard changes press Escape.",' +
		'"raw":false,"min":false},{"text":"\u2022   Try Ctrl-Enter, see what it does.\\n\u2022   Try Ctrl-Shift-Enter t' +
		'oo.","raw":false,"min":false},{"text":"\u2022   Hover over a note to show its  \u2261  menu.\\n\u2022   Hover ' +
		'over  \u2261  to reveal the options.","raw":false,"min":false},{"text":"\u2022   X  deletes the note.\\n\u2022' +
		'   R changes how a note looks.\\n\u2022   _  collapses the note.","raw":false,"min":false},{"text":"This is a ' +
		'raw note.","raw":true,"min":false},{"text":"This is a collapsed note. Only its first line is visible. Useful f' +
		'or keeping lists compact.","raw":false,"min":true}, {"text":"Links","raw":true,"min":false}, {"text":"Links pu' +
		'lse on hover and can be opened via the right-click menu  -  https://nullboard.io","raw":false,"min":false}, {"tex' +
		't":"Pressing CapsLock highlights all links and makes them left-clickable.","raw":false,"min":false}]},{"title"' +
		':"More things to try","notes":[{"text":"\u2022   Drag notes around to rearrange.\\n\u2022   Works between the ' +
		'lists too.","raw":false,"min":false},{"text":"\u2022   Click on a list name to edit.\\n\u2022   Enter to save,' +
		' Esc to cancel.","raw":false,"min":false},{"text":"\u2022   Try adding a new list.\\n\u2022   Try deleting one' +
		'. This  _can_  be undone.","raw":false,"min":false},{"text":"\u2022   Same for the board name.","raw":false,"m' +
		'in":false},{"text":"Boards","raw":true,"min":false},{"text":"\u2022   Check out   \u2261   at the top right.",' +
		'"raw":false,"min":false},{"text":"\u2022   Try adding a new board.\\n\u2022   Try switching between the boards' +
		'.","raw":false,"min":false},{"text":"\u2022   Try deleting a board. Unlike deleting a\\n     list this  _canno' +
		't_  be undone.","raw":false,"min":false},{"text":"\u2022   Export the board   (save to a file, as json)\\n' +
		'\u2022   Import the board   (load from a save)","raw":false,"min":false}]}]}';

	var demo = parseBoard(blob);

	if (!demo)
		return false;

	demo.id = nanoid(7);
	demo.revision = 1;
	demo.history = [1];

	localStorage.setItem('nullboard.board.' + demo.id + '.' + demo.revision, JSON.stringify(demo));
	localStorage.setItem('nullboard.board.' + demo.id, demo.revision);
	localStorage.setItem('nullboard.last_board', demo.id);
	db.put({key: 'last_board', value:  demo.id}).then(data=> {
		console.log('last_board', data);
	})
	db.put({key: demo.id, value:  JSON.stringify(demo)}).then(data=> {
		console.log(data);
	})

	return demo.id;
}

/*
 *
 */
function startEditing($text, ev) {
	var $note = $text.parent();
	var $edit = $note.find('.edit');

	$note[0]._collapsed = $note.hasClass('collapsed');
	$note.removeClass('collapsed');

	$edit.val(getText($text));
	$edit.width($text.width());
	$edit.height($text.height());
	$note.addClass('editing');

	$edit.focus();
}

function stopEditing($edit, via_escape) {
	var $item = $edit.parent();
	if (!$item.hasClass('editing'))
		return;

	$item.removeClass('editing');
	if ($item[0]._collapsed)
		$item.addClass('collapsed')

	//
	var $text = $item.find('.text');
	var text_now = $edit.val().trimRight();
	var text_was = getText($text);

	//
	var brand_new = $item.hasClass('brand-new');
	$item.removeClass('brand-new');

	if (via_escape) {
		if (brand_new) {
			$item.closest('.note, .list, .board').remove();
			return;
		}
	}
	else
		if (text_now != text_was || brand_new) {
			setText($text, text_now);

			saveBoard();
			updatePageTitle();
		}

	//
	if (brand_new && $item.hasClass('list'))
		addNote($item);
}

//
function addNote($list, $after, $before) {
	var $note = $('tt .note').clone();
	var $notes = $list.find('.notes');

	$note.find('.text').html('');
	$note.addClass('brand-new');

	if ($before) {
		$before.before($note);
		$note = $before.prev();
	}
	else
		if ($after) {
			$after.after($note);
			$note = $after.next();
		}
		else {
			$notes.append($note);
			$note = $notes.find('.note').last();
		}

	$note.find('.text').click();
}

function deleteNote($note) {
	$note
		.animate({ opacity: 0 }, 'fast')
		.slideUp('fast')
		.queue(function () {
			$note.remove();
			saveBoard();
		});
}

//
function addList() {
	var $board = $('.wrap .board');
	var $lists = $board.find('.lists');
	var $list = $('tt .list').clone();

	$list.find('.text').html('');
	$list.find('.head').addClass('brand-new');

	$lists.append($list);
	$board.find('.lists .list .head .text').last().click();

	var lists = $lists[0];
	lists.scrollLeft = Math.max(0, lists.scrollWidth - lists.clientWidth);

	setupListScrolling();
}

function deleteList($list) {
	var empty = true;

	$list.find('.note .text').each(function () {
		empty &= ($(this).html().length == 0);
	});

	if (!empty && !confirm("Delete this list and all its notes?"))
		return;

	$list
		.animate({ opacity: 0 })
		.queue(function () {
			$list.remove();
			saveBoard();
		});

	setupListScrolling();
}

function moveList($list, left) {
	var $a = $list;
	var $b = left ? $a.prev() : $a.next();

	var $menu_a = $a.find('> .head .menu .bulk');
	var $menu_b = $b.find('> .head .menu .bulk');

	var pos_a = $a.offset().left;
	var pos_b = $b.offset().left;

	$a.css({ position: 'relative' });
	$b.css({ position: 'relative' });

	$menu_a.hide();
	$menu_b.hide();

	$a.animate({ left: (pos_b - pos_a) + 'px' }, 'fast');
	$b.animate({ left: (pos_a - pos_b) + 'px' }, 'fast', function () {

		if (left) $list.prev().before($list);
		else $list.before($list.next());

		$a.css({ position: '', left: '' });
		$b.css({ position: '', left: '' });

		$menu_a.css({ display: '' });
		$menu_b.css({ display: '' });

		saveBoard();
	});
}

//
 function openBoard(board_id) {
	closeBoard(true);

	document.board = loadBoard(board_id);

	localStorage.setItem('nullboard.last_board', board_id);
	db.put({key: 'last_board', value:  board_id}).then(data=> {
		console.log('last_board', data);
	})

	showBoard(true);
}

function reopenBoard(revision) {
	var board_id = document.board.id;

	var via_menu = $('.wrap .board > .head .menu .bulk').is(':visible');

	localStorage.setItem('nullboard.board.' + board_id, revision);

	openBoard(board_id);

	if (via_menu) {
		var $menu = $('.wrap .board > .head .menu');
		var $teaser = $menu.find('.teaser');
		var $bulk = $menu.find('.bulk');

		$teaser.hide().delay(100).queue(function () { $(this).css('display', '').dequeue(); });
		$bulk.show().delay(100).queue(function () { $(this).css('display', '').dequeue(); });
	}
}

 function closeBoard(quick) {
	var $board = $('.wrap .board');

	if (quick)
		$board.remove();
	else
		$board
			.animate({ opacity: 0 }, 'fast')
			.queue(function () { $board.remove(); });

	document.board = null;
	localStorage.setItem('nullboard.last_board', null);
	db.put({key: 'last_board', value:  null}).then(data=> {
		console.log('last_board', null);
	})
	updateUndoRedo();
	updateBoardIndex();
}

//
 function addBoard() {
	document.board = new Board('');
	document.board.history = [0];
	console.log(document.board.id);
	document.board_id = document.board.id;
	localStorage.setItem('nullboard.last_board', document.board.id);
	db.put({key: 'last_board', value: document.board.id}).then(data=> {
		console.log('last_board', data);
	})
	showBoard(false);

	$('.wrap .board .head').addClass('brand-new');
	$('.wrap .board .head .text').click();
}

function deleteBoard() {
	var $list = $('.wrap .board .list');

	if ($list.length && !confirm("PERMANENTLY delete this board, all its lists and their notes?"))
		return;

	nukeBoard();
	closeBoard();
}

//
function undoBoard() {
	if (!document.board)
		return false;

	var hist = document.board.history;
	var have = document.board.revision;
	var want = 0;

	for (var i = 0; i < hist.length - 1 && !want; i++)
		if (have == hist[i])
			want = hist[i + 1];

	if (!want) {
		console.log('Undo - failed');
		return false;
	}

	console.log('Undo -> ' + want);

	reopenBoard(want);
	return true;
}

function redoBoard() {
	if (!document.board)
		return false;

	var hist = document.board.history;
	var have = document.board.revision;
	var want = 0;

	for (var i = 1; i < hist.length && !want; i++)
		if (have == hist[i])
			want = hist[i - 1];

	if (!want) {
		console.log('Redo - failed');
		return false;
	}

	console.log('Redo -> ' + want);

	reopenBoard(want);
	return true;
}

/*
 *
 */
function Drag() {
	this.item = null;                // .text of .note
	this.priming = null;
	this.primexy = { x: 0, y: 0 };
	this.$drag = null;
	this.mouse = null;
	this.delta = { x: 0, y: 0 };
	this.in_swap = false;

	this.prime = function (item, ev) {
		var self = this;
		this.item = item;
		this.priming = setTimeout(function () { self.onPrimed.call(self); }, ev.altKey ? 1 : 500);
		this.primexy.x = ev.clientX;
		this.primexy.y = ev.clientY;
		this.mouse = ev;
	}

	this.cancelPriming = function () {
		if (this.item && this.priming) {
			clearTimeout(this.priming);
			this.priming = null;
			this.item = null;
		}
	}

	this.end = function () {
		this.cancelPriming();
		this.stopDragging();
	}

	this.isActive = function () {
		return this.item && (this.priming == null);
	}

	this.onPrimed = function () {
		clearTimeout(this.priming);
		this.priming = null;
		this.item.was_dragged = true;

		var $text = $(this.item);
		var $note = $text.parent();
		$note.addClass('dragging');

		$('body').append('<div class=dragster></div>');
		var $drag = $('body .dragster').last();

		if ($note.hasClass('collapsed'))
			$drag.addClass('collapsed');

		$drag.html($text.html());

		$drag.innerWidth($note.innerWidth());
		$drag.innerHeight($note.innerHeight());

		this.$drag = $drag;

		var $win = $(window);
		var scroll_x = $win.scrollLeft();
		var scroll_y = $win.scrollTop();

		var pos = $note.offset();
		this.delta.x = pos.left - this.mouse.clientX - scroll_x;
		this.delta.y = pos.top - this.mouse.clientY - scroll_y;
		this.adjustDrag();

		$drag.css({ opacity: 1 });

		$('body').addClass('dragging');
	}

	this.adjustDrag = function () {
		if (!this.$drag)
			return;

		var $win = $(window);
		var scroll_x = $win.scrollLeft();
		var scroll_y = $win.scrollTop();

		var drag_x = this.mouse.clientX + this.delta.x + scroll_x;
		var drag_y = this.mouse.clientY + this.delta.y + scroll_y;

		this.$drag.offset({ left: drag_x, top: drag_y });

		if (this.in_swap)
			return;

		/*
		 *	see if a swap is in order
		 */
		var pos = this.$drag.offset();
		var x = pos.left + this.$drag.width() / 2 - $win.scrollLeft();
		var y = pos.top + this.$drag.height() / 2 - $win.scrollTop();

		var drag = this;
		var prepend = null;   // if dropping on the list header
		var target = null;    // if over some item
		var before = false;   // if should go before that item

		$(".board .list").each(function () {

			var list = this;
			var rc = list.getBoundingClientRect();
			var y_min = rc.bottom;
			var n_min = null;

			if (x <= rc.left || rc.right <= x || y <= rc.top || rc.bottom <= y)
				return;

			var $list = $(list);

			$list.find('.note').each(function () {
				var note = this;
				var rc = note.getBoundingClientRect();

				if (rc.top < y_min) {
					y_min = rc.top;
					n_min = note;
				}

				if (y <= rc.top || rc.bottom <= y)
					return;

				if (note == drag.item.parentNode)
					return;

				target = note;
				before = (y < (rc.top + rc.bottom) / 2);
			});

			/*
			 *	dropping on the list header
			 */
			if (!target && y < y_min) {
				if (n_min) // non-empty list
				{
					target = n_min;
					before = true;
				}
				else {
					prepend = list;
				}
			}
		});

		if (!target && !prepend)
			return;

		if (target) {
			if (target == drag.item.parentNode)
				return;

			if (!before && target.nextSibling == drag.item.parentNode ||
				before && target.previousSibling == drag.item.parentNode)
				return;
		}
		else {
			if (prepend.firstChild == drag.item.parentNode)
				return;
		}

		/*
		 *	swap 'em
		 */
		var $have = $(this.item.parentNode);
		var $want = $have.clone();

		$want.css({ display: 'none' });

		if (target) {
			var $target = $(target);

			if (before) {
				$want.insertBefore($target);
				$want = $target.prev();
			}
			else {
				$want.insertAfter($target);
				$want = $target.next();
			}

			drag.item = $want.find('.text')[0];
		}
		else {
			var $notes = $(prepend).find('.notes');

			$notes.prepend($want);

			drag.item = $notes.find('.note .text')[0];
		}

		//
		var h = $have.height();

		drag.in_swap = true;

		$have.animate({ height: 0 }, 'fast', function () {
			$have.remove();
			$want.css({ marginTop: 5 });
			saveBoard();
		});

		$want.css({ display: 'block', height: 0, marginTop: 0 });
		$want.animate({ height: h }, 'fast', function () {
			$want.css({ opacity: '', height: '' });
			drag.in_swap = false;
			drag.adjustDrag();
		});
	}

	this.onMouseMove = function (ev) {
		this.mouse = ev;

		if (!this.item)
			return;

		if (this.priming) {
			var x = ev.clientX - this.primexy.x;
			var y = ev.clientY - this.primexy.y;
			if (x * x + y * y > 5 * 5)
				this.onPrimed();
		}
		else {
			this.adjustDrag();
		}
	}

	this.stopDragging = function () {
		$(this.item).parent().removeClass('dragging');
		$('body').removeClass('dragging');

		if (this.$drag) {
			this.$drag.remove();
			this.$drag = null;

			if (window.getSelection) { window.getSelection().removeAllRanges(); }
			else if (document.selection) { document.selection.empty(); }
		}

		this.item = null;
	}
}

/*
 *
 */
function peekBoardTitle(board_id) {
	var revision = localStorage.getItem('nullboard.board.' + board_id);
	if (!revision)
		return false;

	var blob = localStorage.getItem('nullboard.board.' + board_id + '.' + revision);
	db.get(board_id).then(data => {
		console.log(data.value);
	})
	if (!blob)
		return false;

	var head = blob.indexOf(',"lists":\[{"');
	var peek = (head != -1) ? blob.substring(0, head) + '}' : blob;

	try { peek = JSON.parse(peek); } catch (x) { return false; }

	return peek && peek.title;
}

function updateBoardIndex() {
	console.log("triggered")
	var $index = $('.config .boards');
	var $export = $('.config .exp-board');
	var $entry = $('tt .load-board');

	var $board = $('.wrap .board');
	var id_now = document.board && document.board.id;
	var empty = true;

	$index.html('');
	$index.hide();

	for (var i = 0; i < localStorage.length; i++) {

		var k = localStorage.key(i);
		var m = k.match(/^nullboard\.board\.(\w+)$/);
		console.log(m);
		if (!m)
			continue;
		var board_id = m[1];
		var title = peekBoardTitle(board_id);
		if (title === false)
			continue;

		var $e = $entry.clone();
		$e[0].board_id = board_id;
		$e.html(title || '(unnamed board)');

		if (board_id == id_now)
			$e.addClass('active');

		$index.append($e);
		empty = false;
	}

	if (id_now) $export.show();
	else $export.hide();

	if (!empty) $index.show();
}

//
function showDing() {
	$('body')
		.addClass('ding')
		.delay(100)
		.queue(function () { $(this).removeClass('ding').dequeue(); });
}

//
function showOverlay($overlay, $div) {
	$overlay
		.html('')
		.append($div)
		.css({ opacity: 0, display: 'block' })
		.animate({ opacity: 1 });
}

function hideOverlay($overlay) {
	$overlay.animate({ opacity: 0 }, function () {
		$overlay.hide();
	});
}

//
function formatLicense() {
	var text = document.head.childNodes[1].nodeValue;
	var pos = text.search('LICENSE');
	var qos = text.search('Software:');
	var bulk;

	bulk = text.substr(pos, qos - pos);
	bulk = bulk.replace(/([^\n])\n\t/g, '$1 ');
	bulk = bulk.replace(/\n\n\t/g, '\n\n');
	bulk = bulk.replace(/([A-Z ]{7,})/g, '<u>$1</u>');

	//
	var c1 = [];
	var c2 = [];

	text.substr(qos).trim().split('\n').forEach(function (line) {
		line = line.split(':');
		c1.push(line[0].trim() + ':');
		c2.push(line[1].trim());
	});

	bulk += '<span>' + c1.join('<br>') + '</span>';
	bulk += '<span>' + c2.join('<br>') + '</span>';

	//
	var links =
		[
			{ text: '2-clause BSD license', href: 'https://opensource.org/licenses/BSD-2-Clause/' },
			{ text: 'Commons Clause', href: 'https://commonsclause.com/' }
		];

	links.forEach(function (l) {
		bulk = bulk.replace(l.text, '<a href="' + l.href + '" target=_blank>' + l.text + '</a>');
	});

	return bulk.trim();
}

/*
 *
 */
var drag = new Drag();

//
function setRevealState(ev) {
	var raw = ev.originalEvent;
	var caps = raw.getModifierState && raw.getModifierState('CapsLock');

	if (caps) $('body').addClass('reveal');
	else $('body').removeClass('reveal');
}

$(window).live('blur', function () {
	$('body').removeClass('reveal');
});

$(document).live('keydown', function (ev) {
	setRevealState(ev);
});

$(document).live('keyup', function (ev) {

	var raw = ev.originalEvent;

	setRevealState(ev);

	if (ev.target.nodeName == 'TEXTAREA' ||
		ev.target.nodeName == 'INPUT')
		return;

	if (ev.ctrlKey && (raw.code == 'KeyZ')) {
		var ok = ev.shiftKey ? redoBoard() : undoBoard();
		if (!ok)
			showDing();
	}
	else
		if (ev.ctrlKey && (raw.code == 'KeyY')) {
			if (!redoBoard())
				showDing();
		}
});

$('.board .text').live('click', function (ev) {

	if (this.was_dragged) {
		this.was_dragged = false;
		return false;
	}

	drag.cancelPriming();

	startEditing($(this), ev);
	return false;
});

$('.board .note .text a').live('click', function (ev) {

	if (!$('body').hasClass('reveal'))
		return true;

	ev.stopPropagation();
	return true;
});

//
function handleTab(ev) {
	var $this = $(this);
	var $note = $this.closest('.note');
	var $sibl = ev.shiftKey ? $note.prev() : $note.next();

	if ($sibl.length) {
		stopEditing($this, false);
		$sibl.find('.text').click();
	}
}

$('.board .edit').live('keydown', function (ev) {

	// esc
	if (ev.keyCode == 27) {
		stopEditing($(this), true);
		return false;
	}

	// tab
	if (ev.keyCode == 9) {
		handleTab.call(this, ev);
		return false;
	}

	// enter
	if (ev.keyCode == 13 && ev.ctrlKey) {
		var $this = $(this);
		var $note = $this.closest('.note');
		var $list = $note.closest('.list');

		stopEditing($this, false);

		if ($note && ev.shiftKey) // ctrl-shift-enter
			addNote($list, null, $note);
		else
			if ($note && !ev.shiftKey) // ctrl-enter
				addNote($list, $note);

		return false;
	}

	if (ev.keyCode == 13 && this.tagName == 'INPUT' ||
		ev.keyCode == 13 && ev.altKey ||
		ev.keyCode == 13 && ev.shiftKey) {
		stopEditing($(this), false);
		return false;
	}

	//
	if (ev.key == '*' && ev.ctrlKey) {
		var have = this.value;
		var pos = this.selectionStart;
		var want = have.substr(0, pos) + '\u2022 ' + have.substr(this.selectionEnd);
		$(this).val(want);
		this.selectionStart = this.selectionEnd = pos + 2;
		return false;
	}

	return true;
});

$('.board .edit').live('keypress', function (ev) {

	// tab
	if (ev.keyCode == 9) {
		handleTab.call(this, ev);
		return false;
	}
});

//
$('.board .edit').live('blur', function (ev) {
	if (document.activeElement != this)
		stopEditing($(this));
	else
		; // switch away from the browser window
});

//
$('.board .note .edit').live('input propertychange', function () {

	var delta = $(this).outerHeight() - $(this).height();

	$(this).height(10);

	if (this.scrollHeight > this.clientHeight)
		$(this).height(this.scrollHeight - delta);

});

//
$('.config .add-board').live('click', function () {
	addBoard();
	return false;
});

$('.config .load-board').live('click', function () {

	var board_id = $(this)[0].board_id;
	if ((document.board && document.board.id) == board_id)
		closeBoard();
	else
		openBoard($(this)[0].board_id);

	return false;
});

$('.board .del-board').live('click', function () {
	deleteBoard();
	return false;
});

$('.board .undo-board').live('click', function () {
	undoBoard();
	return false;
});

$('.board .redo-board').live('click', function () {
	redoBoard();
	return false;
});

//
$('.board .add-list').live('click', function () {
	addList();
	return false;
});

$('.board .del-list').live('click', function () {
	deleteList($(this).closest('.list'));
	return false;
});

$('.board .mov-list-l').live('click', function () {
	moveList($(this).closest('.list'), true);
	return false;
});

$('.board .mov-list-r').live('click', function () {
	moveList($(this).closest('.list'), false);
	return false;
});

//
$('.board .add-note').live('click', function () {
	addNote($(this).closest('.list'));
	return false;
});

$('.board .del-note').live('click', function () {
	deleteNote($(this).closest('.note'));
	return false;
});

$('.board .raw-note').live('click', function () {
	$(this).closest('.note').toggleClass('raw');
	saveBoard();
	return false;
});

$('.board .collapse').live('click', function () {
	$(this).closest('.note').toggleClass('collapsed');
	saveBoard();
	return false;
});

//
$('.board .note .text').live('mousedown', function (ev) {
	drag.prime(this, ev);
});

$(document).on('mouseup', function (ev) {
	drag.end();
});

$(document).on('mousemove', function (ev) {
	setRevealState(ev);
	drag.onMouseMove(ev);
});

//
$('.config .imp-board').click(function (ev) {
	$('.config .imp-board-select').click();
	return false;
});

$('.config .imp-board-select').change(function () {
	var files = this.files;
	var reader = new FileReader();
	reader.onload = function (ev) { importBoard(ev.target.result); };
	reader.readAsText(files[0]);
	return true;
});

$('.config .exp-board').click(function () {
	var board = document.board;
	var revision = localStorage.getItem('nullboard.board.' + board.id);
	if (!revision)
		return false;

	var blob = localStorage.getItem('nullboard.board.' + board.id + '.' + revision);
	db.get(board_id).then(data => {
		console.log(data.value);
	})
	if (!blob)
		return false;

	var file = 'Nullboard-' + board.id + '-' + board.title + '.nbx';

	blob = encodeURIComponent(blob);
	blob = "data:application/octet-stream," + blob;

	$(this).attr('href', blob);
	$(this).attr('download', file);
	return true;
});

$('.config .switch-theme').click(function () {
	var $body = $('body');
	$body.toggleClass('dark');
	localStorage.setItem('nullboard.theme', $body.hasClass('dark') ? 'dark' : '');
	db.put({key:'nullboard.theme', value: $body.hasClass('dark') ? 'dark' : ''});
	return false;
});

$('.config .switch-fsize').click(function () {
	var $body = $('body');
	$body.toggleClass('z1');
	localStorage.setItem('nullboard.fsize', $body.hasClass('z1') ? 'z1' : '');
	db.put({key:'nullboard.fsize', value:$body.hasClass('z1') ? 'z1' : ''});
	return false;
});

//
var $overlay = $('.overlay');

$overlay.click(function (ev) {
	if (ev.originalEvent.target != this)
		return true;
	hideOverlay($overlay);
	return false;
});

$(window).keydown(function (ev) {
	if ($overlay.css('display') != 'none' && ev.keyCode == 27)
		hideOverlay($overlay);
});

$('.view-about').click(function () {
	var $div = $('tt .about').clone();
	$div.find('div').html('Version ' + nb_codeVersion);
	showOverlay($overlay, $div);
	return false;
});

$('.view-license').click(function () {

	var $div = $('tt .license').clone();
	$div.html(formatLicense());
	showOverlay($overlay, $div);
	return false;
});

//
function adjustLayout() {
	var $body = $('body');
	var $board = $('.board');

	if (!$board.length)
		return;

	var lists = $board.find('.list').length;
	var lists_w = (lists < 2) ? 250 : 260 * lists - 10;
	var body_w = $body.width();

	if (lists_w + 190 <= body_w) {
		$board.css('max-width', '');
		$body.removeClass('crowded');
	}
	else {
		var max = Math.floor((body_w - 40) / 260);
		max = (max < 2) ? 250 : 260 * max - 10;
		$board.css('max-width', max + 'px');
		$body.addClass('crowded');
	}
}

$(window).resize(adjustLayout);

adjustLayout();

//
function adjustListScroller() {
	var $board = $('.board');
	if (!$board.length)
		return;

	var $lists = $('.board .lists');
	var $scroller = $('.board .lists-scroller');
	var $inner = $scroller.find('div');

	var max = $board.width();
	var want = $lists[0].scrollWidth;
	var have = $inner.width();

	if (want <= max) {
		$scroller.hide();
		return;
	}

	$scroller.show();
	if (want == have)
		return;

	$inner.width(want);
	cloneScrollPos($lists, $scroller);
}

//
function cloneScrollPos($src, $dst) {
	var src = $src[0];
	var dst = $dst[0];

	if (src._busyScrolling) {
		src._busyScrolling--;
		return;
	}

	dst._busyScrolling++;
	dst.scrollLeft = src.scrollLeft;
}

function setupListScrolling() {
	var $lists = $('.board .lists');
	var $scroller = $('.board .lists-scroller');

	adjustListScroller();

	$lists[0]._busyScrolling = 0;
	$scroller[0]._busyScrolling = 0;

	$scroller.on('scroll', function () { cloneScrollPos($scroller, $lists); });
	$lists.on('scroll', function () { cloneScrollPos($lists, $scroller); });

	adjustLayout();
}

//
if (localStorage.getItem('nullboard.theme') == 'dark')
	$('body').addClass('dark');

if (localStorage.getItem('nullboard.fsize') == 'z1')
	$('body').addClass('z1');

localStorage.clear();
var board_id;
db.fetch().next().then(data => {
	if (data.value.length > 0){
	for (const item of data.value) {
		if (item.key == 'last_board'){
			localStorage.setItem('nullboard.last_board', item.value);
			board_id = item.value;
		}
		else if (item.key == 'nullboard.theme'){
			localStorage.setItem('nullboard.theme', item.value);
		}	
		else if (item.key == 'nullboard.fsize'){
			localStorage.setItem('nullboard.fsize', item.value);
		}	
		else {
			var board = JSON.parse(item.value);
			var blob_id = item.key + '.' + board.revision;
			localStorage.setItem('nullboard.board.' + blob_id, JSON.stringify(board));
			localStorage.setItem('nullboard.board.' + board.id, board.revision);
		}
	}
	}
	if (board_id){
		console.log(board_id);
		document.board = loadBoard(board_id);
		console.log(document.board)
	}
	updateBoardIndex();
	
	if (!document.board && !$('.config .load-board').length) {
		var demo_id = createDemoBoard();
		document.board = loadBoard(demo_id);
		updateBoardIndex();
	}
	
	if (document.board) {
		showBoard(true);
	}
	
	//
	setInterval(adjustListScroller, 100);
	
	setupListScrolling();

	console.log(data.value);
})




