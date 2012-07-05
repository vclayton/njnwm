var x11 = require('x11');

var wm;
var X;
var moveCursor;

var MoveWindow = function(_wm) {
	wm = _wm;
};

MoveWindow.prototype.initDisplay = function() {
	X = wm.X;
	moveCursor = wm.CreateGlyphCursor('move', x11.XC.Fleur);
};

MoveWindow.prototype.onButtonPress = function(ev) {
//	console.log("Move plugin onButtonPress:", ev);
	if (ev.detail==1 && this.dragStart === null && (ev.child===0 || ev.state & x11.KeyButMask.Mod4)) {
		this.GrabPointer(x11.EventMask.PointerMotion|x11.EventMask.ButtonRelease, moveCursor);
		console.log("Drag start");
		this.dragStart = { rootx: ev.root_x, rooty: ev.root_y, x: ev.event_x, y: ev.event_y, winX: this.x, winY: this.y };
	}
	this.onButtonPress(ev);
};

MoveWindow.prototype.onButtonRelease = function(ev) {
	if (this.dragStart !== null) {
		console.log("Move plugin onButtonRelease:", ev);
		console.log("Drag stop");
		this.dragStart = null;
		this.redraw();
		this.UngrabPointer();
	}
	this.onButtonRelease(ev);
};

MoveWindow.prototype.onMotionNotify = function(ev) {
	console.log("Move plugin onMotionNotify:" + ev.event);
	if (this.dragStart !== null) {
//		console.log("Drag move", this.dragStart);
		var dx = ev.root_x - this.dragStart.rootx;
		var dy = ev.root_y - this.dragStart.rooty;
		this.x = this.dragStart.winX + dx;
		this.y = this.dragStart.winY + dy;

		// this.move(dx, dy);
		this.syncPosition();

	}
	this.onMotionNotify(ev);
};

MoveWindow.prototype.initWindow = function(win) {
	win.dragStart = null;

	win.plugs.prepend('onButtonPress', MoveWindow.prototype.onButtonPress);
	win.plugs.prepend('onButtonRelease', MoveWindow.prototype.onButtonRelease);
	win.plugs.prepend('onMotionNotify', MoveWindow.prototype.onMotionNotify);
};


//console.log("Plugin loaded: Move");
module.exports = {
	load: function(wm) {
		return new MoveWindow(wm);
	}
};