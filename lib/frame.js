// Frames
// -------
var Frame = function(X, win) {
	this.X = X;
//  this.nwm = wm;
	this.id = ev.wid;
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

Frame.prototype = {
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

Frame.prototype.map = function() {
	var white = 16777215;
// Create frame window
	frameId = this.X.AllocID();
	this.frameId = frameId;
	this.X.CreateWindow(frameId, this.X.display.screen[0].root, 0, 0, this.width + (3 * 2), this.height + (3 + 10), 1, 1, 0, { backgroundPixel: white });

// Reparent window into frame
	this.X.ReparentWindow(this.id, frameId, this.borderWidth, this.titleHeight);

// Map Frame, Map Window
	this.X.MapWindow(this.frameId);
	this.X.MapWindow(this.id);
//	this.X.flush();

// Draw frame
// Configure frame and window events
// Register event handler callbacks
	console.log("Frame: map finish");
}
