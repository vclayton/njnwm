var x11 = require('x11');

var wm;
var X;
var leftCursor,rightCursor,upCursor,upLeftCursor,upRightCursor,downCursor,downLeftCursor,downRightCursor,middleCursor;
var resizeMask;

var Mask = {
	None: 0x00,
	Up: 0x01,
	Down: 0x02,
	Left: 0x04,
	Right: 0x08
};
var CursorsByMask = {};

var ResizeWindow = function(_wm) {
	wm = _wm;
};

ResizeWindow.prototype.initDisplay = function() {
	X = wm.X;
	CursorsByMask[Mask.Left] = leftCursor = wm.CreateGlyphCursor('left', x11.XC.LeftSide);
	CursorsByMask[Mask.Right] = rightCursor = wm.CreateGlyphCursor('right', x11.XC.RightSide);
	CursorsByMask[Mask.Up] = upCursor = wm.CreateGlyphCursor('up', x11.XC.TopSide);
	CursorsByMask[Mask.Up|Mask.Left] = upLeftCursor = wm.CreateGlyphCursor('upleft', x11.XC.TopLeftCorner);
	CursorsByMask[Mask.Up|Mask.Right] = upRightCursor = wm.CreateGlyphCursor('upright', x11.XC.TopRightCorner);
	CursorsByMask[Mask.Down] = downCursor = wm.CreateGlyphCursor('up', x11.XC.BottomSide);
	CursorsByMask[Mask.Down|Mask.Left] = downLeftCursor = wm.CreateGlyphCursor('upleft', x11.XC.BottomLeftCorner);
	CursorsByMask[Mask.Down|Mask.Right] = downRightCursor = wm.CreateGlyphCursor('upright', x11.XC.BottomRightCorner);
	CursorsByMask[Mask.None] = middleCursor = wm.CreateGlyphCursor('middle', x11.XC.Fleur);
};

ResizeWindow.prototype.findResizeRegion = function(mx, my) {
	var sliceX = this.clientGeom.width / 3;
	var sliceY = this.clientGeom.height / 3;
	var mask = 0;

	if (mx < sliceX) {
		mask |= Mask.Left;
	} else if (mx > sliceX * 2) {
		mask |= Mask.Right;
	}

	if (my < sliceY) {
		mask |= Mask.Up;
	} else if (my > sliceY * 2) {
		mask |= Mask.Down;
	}
	return mask;
};

ResizeWindow.prototype.onButtonPress = function(ev) {
//	console.log("Move plugin onButtonPress:", ev);
	if (ev.detail==3 && this.resizeStart === null && (ev.child===0 || ev.state & x11.KeyButMask.Mod4)) {

		var resizeMask = this.findResizeRegion(ev.event_x, ev.event_y);

		this.GrabPointer(x11.EventMask.PointerMotion|x11.EventMask.ButtonRelease, CursorsByMask[resizeMask]);
		this.resizeStart = {
			mask: resizeMask,
			rootx: ev.root_x,
			rooty: ev.root_y,
			x: ev.event_x,
			y: ev.event_y,
			width: this.width,
			height: this.height,
			winLeft: this.x,
			winTop: this.y,
			winRight: this.x + this.width,
			winBottom: this.y + this.height
		};
//		console.log("resize start", this.resizeStart);
	} else {
		this.onButtonPress(ev);
	}
};

ResizeWindow.prototype.onButtonRelease = function(ev) {
//	console.log("Move plugin onButtonRelease:", ev);
	if (this.resizeStart !== null) {
		this.UngrabPointer();
//		console.log("resize stop");
		X.ConfigureWindow({window:this.fid, value_mask: { X: this.x, Y:this.y, Width: this.width, Height: this.height}});
		this.resizeStart = null;
		this.redraw();
	} else {
		this.onButtonRelease(ev);
	}
};

ResizeWindow.prototype.onMotionNotify = function(ev) {
	console.log("Resize plugin onMotionNotify:", ev.event);
	if (this.resizeStart !== null) {
//		console.log("resize move", this.resizeStart);
		var dx = ev.root_x - this.resizeStart.rootx;
		var dy = ev.root_y - this.resizeStart.rooty;

		if (this.resizeStart.mask & Mask.Right) {
			this.width = this.resizeStart.width + dx;
		}
		if (this.resizeStart.mask & Mask.Left) {
			this.width = this.resizeStart.width - dx;
			this.x = this.resizeStart.winLeft + dx;
		}
		if (this.resizeStart.mask & Mask.Up) {
			this.height = this.resizeStart.height - dy;
			this.y = this.resizeStart.winTop + dy;
		}
		if (this.resizeStart.mask & Mask.Down) {
			this.height = this.resizeStart.height + dy;
		}

		X.ConfigureWindow({window:this.fid, value_mask: { X: this.x, Y:this.y, Width: this.width, Height: this.height}});
		X.ConfigureWindow({window:this.wid, value_mask: { X: this.border, Y: this.border + this.titleHeight, Width: this.width - this.border*4, Height: this.height - this.titleHeight - this.border*4 }});
	} else {
		this.onMotionNotify(ev);
	}
};

ResizeWindow.prototype.initWindow = function(win) {
	win.resizeStart = null;
	win.findResizeRegion = ResizeWindow.prototype.findResizeRegion;

	win.plugs.prepend('onButtonPress', ResizeWindow.prototype.onButtonPress);
	win.plugs.prepend('onButtonRelease', ResizeWindow.prototype.onButtonRelease);
	win.plugs.prepend('onMotionNotify', ResizeWindow.prototype.onMotionNotify);
};


//console.log("Plugin loaded: Move");
module.exports = {
	load: function(wm) {
		return new ResizeWindow(wm);
	}
};