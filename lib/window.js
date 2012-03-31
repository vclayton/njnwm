var x11 = { event: require('./x11/event').event };
var EventEmitter = require('events').EventEmitter;


// Windows
// -------
var Window = function(X, ev) {
	this.X = X;
//  this.nwm = wm;
	this.id = ev.window;
	this.x = ev.x;
	this.y = ev.y;
//  this._monitor = window.monitor;
	this.width = ev.width;
	this.height = ev.height;
	this.title = 'Blah'; //window.title;
//  this.instance = window.instance;
//  this.class = window.class;
// this.isfloating = window.isfloating;
	this.visible = true;
	this.workspace = 1; // window.workspace;
	this.borderWidth = 3;
	this.titleHeight = 10;
	
	
};

Window.prototype = {
	get monitor(){
		return this._monitor;
	},
	set monitor(id){
		// when the monitor_id changes, the monitors should be notified of the change
		if(this._monitor != id) {
			var from = this._monitor;
			this._monitor = id;
			console.log('change window monitor', this.id, from, this._monitor);
			this.nwm.emit('change window monitor', this.id, from, this._monitor);
		}
	}
};

Window.prototype.map = function() {
	var self = this;
	var white = 16777215;
// Create frame window
	frameId = this.X.AllocID();
	this.frameId = frameId;
	this.X.CreateWindow({wid: frameId, parent: this.X.display.screen[0].root, 
		x: 0, y: 0, 
		width: this.width + (3 * 2), height: this.height + (3 + 10), 
		border_width: 1, _class: 1, visual: 0, value_mask: {BackPixel: white} });

// Reparent window into frame
	this.X.ReparentWindow({window: this.id, parent: frameId, x: this.borderWidth, y: this.titleHeight});

// Map Frame, Map Window
	this.X.MapWindow({window: this.frameId});
	this.X.MapWindow({window: this.id});

// Draw frame
// Configure frame and window events
// Register event handler callbacks

		var ee = new EventEmitter();
		this.X.event_consumers[self.frameId] = ee;
		ee.on('event', function(ev)
		{
			if (ev.type === 17) // DestroyNotify
			{
			   X.DestroyWindow({window: frameId});
			} else if (ev.type == 4) {
				dragStart = { rootx: ev.rootx, rooty: ev.rooty, x: ev.x, y: ev.y, winX: self.x, winY: self.y };
			} else if (ev.type == 5) {
				dragStart = null;
			} else if (ev.type == 6) {
				self.x = dragStart.winX + ev.rootx - dragStart.rootx;
				self.y = dragStart.winY + ev.rooty - dragStart.rooty;
				X.ConfigureWindow({window:self.frameId, value_mask: { X:self.x, Y:self.y}});
			}
		});


	console.log("Window: map finish");
}

// Move a window
Window.prototype.move = function(x, y) {
	this.x = x;
	this.y = y;
	console.log('move', this.id, x, y);
	this.nwm.wm.moveWindow(this.id, x, y);
};

// Resize a window
Window.prototype.resize = function(width, height) {
	this.width = width;
	this.height = height;
	console.log('resize', this.id, width, height);
	this.nwm.wm.resizeWindow(this.id, width, height);
};

// Hide a window
Window.prototype.hide = function() {
	if(this.visible) {
		this.visible = false;
//    console.log('hide', this.id);
		// window should be moved to twice the total monitor width
		var total = 0;
		var monitors = Object.keys(this.nwm.monitors.items);
		var self = this;
		monitors.forEach(function(id) {
			total += self.nwm.monitors.get(id).width;
		})
		this.nwm.wm.moveWindow(this.id, this.x + 2 * total, this.y);
	}
};

// Show a window
Window.prototype.show = function() {
	if(!this.visible) {
		this.visible = true;
//    console.log('show', this.id);
		this.nwm.wm.moveWindow(this.id, this.x, this.y);
	}
};

module.exports = Window;
