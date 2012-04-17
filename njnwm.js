
var Buffer = require('buffer').Buffer;

var EventEmitter = require('events').EventEmitter;
var Future = require('fibers/future'), wait = Future.wait;
var Fiberize = require('fiberize');
var Promise = require('fibers-promise');
var exec = require('child_process').exec;

var x11 = require('./lib/x11');
var wid, cidBlack, cidWhite;
var X;
//var Window = require('./lib/window.js');


var Window = function(wm, wid) {
	var self = this;
	self.X = wm.X;
	self.root = wm.root;
	self.wid = wid;
	self.clientGeom = null;
	self.x = 0;
	self.y = 0;

	self.initialize = function initialize(wid) {
		console.log("Managing window "+wid);

		self.X.GetWindowAttributes({window: wid}, function(attrs) {
			console.log("Got attributes:", attrs);
			if (false && attrs.map_state) // @todo Named attribute mask constants
			{
				console.log("Attribute 8?", attrs);
				self.X.MapWindow({window: wid});
				return;
			}



			var fid = self.X.AllocID();
			self.fid = fid;
			wm.frames[fid] = 1;

			self.X.GetGeometry({drawable: wid}, function(clientGeom) {
				self.clientGeom = clientGeom;
				reparent(wid);
			});


			var dragStart = null;
			
			var ee = new EventEmitter();
			self.X.event_consumers[fid] = ee;
			ee.on('event', function(ev)
			{
				console.log(ev);
				if (ev.type === x11.event.DestroyNotify)
				{
					self.X.DestroyWindow({window: fid});
				} else if (ev.type == x11.event.ButtonPress) {
					self.X.AllowEvents({mode: x11.Allow.ReplayPointer, time: x11.Time.CurrentTime});
					self.raise();
					console.log("Drag start");
					dragStart = { rootx: ev.root_x, rooty: ev.root_y, x: ev.event_x, y: ev.event_y, winX: self.x, winY: self.y };
				} else if (ev.type == x11.event.ButtonRelease) {
					console.log("Drag stop");
					dragStart = null;
				} else if (ev.type == x11.event.MotionNotify) {
					console.log("Drag move");
					if (dragStart !== null) {
						console.log(dragStart);
						self.x = dragStart.winX + ev.root_x - dragStart.rootx;
						self.y = dragStart.winY + ev.root_y - dragStart.rooty;
						self.X.ConfigureWindow({window:fid, value_mask: { X: self.x, Y:self.y}});
					}
				}
			});

		});
	}

	self.raise = function raise() {
		self.X.ConfigureWindow({window: self.fid, value_mask: { StackMode: x11.StackMode.Above } });
	}

	function reparent(wid) {
		// todo: Some sensible positioning logic
		self.x = parseInt(Math.random()*300);
		self.y = parseInt(Math.random()*300);

		var frameAttribs = {
			BackPixel: 0xffffe0,
			BorderPixel: 0xe0ffff,
			DontPropagate: x11.EventMask.ButtonPress|x11.EventMask.ButtonRelease|x11.EventMask.ButtonMotion,
			OverrideRedirect: false,
			EventMask: x11.EventMask.ButtonMotion
				|x11.EventMask.ButtonPress
				|x11.EventMask.ButtonRelease
				|x11.EventMask.SubstructureNotify
				|x11.EventMask.SubstructureRedirect
				|x11.EventMask.ExposureMask
				|x11.EventMask.EnterWindowMask
				|x11.EventMask.LeaveWindowMask
		};

		self.X.GrabServer();

		var width = self.clientGeom.width + 4;
		var height = self.clientGeom.height + 24;

		// if(border_width) { b_w = border_width; XSetWindowBorderWidth(dpy, window, 0); } else { b_w = BW; }

		self.X.CreateWindow({wid: self.fid, parent: self.root, x:self.x, y:self.y, width:width, height:height, border_width:1, _class:1, visual:0,
			value_mask: frameAttribs });


		self.X.ChangeWindowAttributes({window: wid, value_mask: x11.CW.DontPropagate, value_list: frameAttribs});

//		self.X.ChangeWindowAttributes({window: wid, value_mask: {x11.CW.DontPropagate}, value_list: frameAttribs}); // self.X.SelectInput({window: wid, FocusChangeMask|PropertyChangeMask});
		self.X.ChangeSaveSet({mode: x11.SetMode.Delete, window: wid}); // Why do we do this? Why not AddToSaveSet()? 
		self.X.ReparentWindow({window: wid, parent:self.fid, x:1, y:21});

		self.X.GrabButton({button: 1, modifiers: x11.ModMask.Any, grab_window: self.fid, owner_events: true, event_mask: x11.EventMask.ButtonPress|x11.EventMask.ButtonRelease, 
			pointer_mode: x11.GrabMode.Sync, keyboard_mode: x11.GrabMode.Async});

		// SendEvent: ConfigureNotify, StructureNotifyMask

		self.X.UngrabServer();

		self.X.MapWindow({window:self.fid});
		self.X.MapWindow({window:wid});

	}

	self.initialize(wid);
}

var WindowManager = function() {
	var self = this;
	self.clients = [];
	self.frames = {};
	self.X = undefined;

	self.xinit = function xinit(xserver) {
		self.xserver = xserver;
		self.X = xserver.client;
		self.root = xserver.screen[0].root;
		self.getAtomName = Future.wrap(self.X.GetAtomName, 1);

		self.setupDisplay();
		self.scanWindows();

		// Do Event Loop
		self.X.on('error', function(err) {
			console.log("Error: ", err);
		}).on('event', function(ev) {
			switch(ev.type) {
				case x11.event.ConfigureRequest:
					self.X.ConfigureWindow({window: ev.window, value_mask: {Width: ev.width, Height: ev.height}});
					break;
				case x11.event.MapRequest:
					if (!self.frames[ev.window]) {
						self.manageWindow(ev.window);
					}
					break;
			}
			console.log("Event: ", ev);
		});
	}

	self.setupDisplay = function setupDisplay() {
		// Here we will eventually also set all of our extended window manager hints for apps to use

		// Define cursor

		// Root event mask
		self.X.ChangeWindowAttributes( {window: self.root, value_mask: { 
			EventMask: x11.EventMask.SubstructureRedirect | x11.EventMask.SubstructureNotifyMask }}, function(err) {
				if (err.error == 10) // @todo Named Error constant
				{
					console.error('Error: another window manager already running.');
					process.exit(1);
				}
		});

		// Grab keys for root window
	}

	self.scanWindows = function scanWindows() {
		self.X.QueryTree({window: self.root}, function(tree) {
			console.log("Children tree: ", tree);
			tree.children.forEach(self.manageWindow);
		});
	}

	self.manageWindow = function manageWindow(wid) {
		self.clients.push(new Window(self, wid));
	}


}



// "Main"
var wm = new WindowManager();
Fiber(function() {
	x11.createClient(wm.xinit);
}).run();

