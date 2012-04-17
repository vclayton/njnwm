
var Buffer = require('buffer').Buffer;

var EventEmitter = require('events').EventEmitter;
var Future = require('fibers/future'), wait = Future.wait;
var Fiberize = require('fiberize');
var Promise = require('fibers-promise');
var exec = require('child_process').exec;

var x11 = require('./lib/x11');
var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
var wid, cidBlack, cidWhite;
var X;
var Window = require('./lib/window.js');


//var WindowManager = {
var WindowManager = function() {
	var self = this;
	self.clients = [];
	self.frames = {};
	self.X = undefined;

	self.xinit = function xinit(xserver) {
		console.log(this);


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
		console.log("xinit done");
	}

	self.setupDisplay = function setupDisplay() {
		// Here we will eventually also set all of our extended window manager hints for apps to use

		// Define cursor

		// Root event mask
		self.X.ChangeWindowAttributes( {window: self.root, value_mask: { 
			EventMask: x11.eventMask.SubstructureRedirect | x11.eventMask.SubstructureNotifyMask }}, function(err) {
				if (err.error == 10) // @todo Named Error constant
				{
					console.error('Error: another window manager already running.');
					process.exit(1);
				}
		});

		// Grab keys for root window
		console.log("setupDisplay done");
	}

	self.scanWindows = function scanWindows() {
		self.X.QueryTree({window: self.root}, function(tree) {
			console.log("Children tree: ", tree);
			tree.children.forEach(self.manageWindow);
		});
		console.log("scanWindows done");
	}

	self.manageWindow = function manageWindow(wid) {
		console.log("Managing window "+wid);
		var events = x11.eventMask.Button1Motion|x11.eventMask.ButtonPress|x11.eventMask.ButtonRelease|x11.eventMask.SubstructureNotify|x11.eventMask.SubstructureRedirect;

		self.X.GetWindowAttributes({window: wid}, function(attrs) {
			console.log("Got attributes:", attrs);
			if (false && attrs.map_state) // @todo Named attribute mask constants
			{
				console.log("Attribute 8?", attrs);
				self.X.MapWindow({window: wid});
				return;
			}

			var fid = self.X.AllocID();
			self.frames[fid] = 1;
			console.log("Frames: ", self.frames);
			var winX, winY;
			var dragStart = null;
			winX = parseInt(Math.random()*300);
			winY = parseInt(Math.random()*300);
			
			self.X.GetGeometry({drawable: wid}, function(clientGeom) {
				var width = clientGeom.width + 4;
				var height = clientGeom.height + 24;
				self.X.CreateWindow({wid: fid, parent: self.root, x:winX, y:winY, width:width, height:height, border_width:1, _class:1, visual:0,
					value_mask: { BackPixel: 0xffffe0, EventMask: events } });

				var ee = new EventEmitter();
				self.X.event_consumers[fid] = ee;
				ee.on('event', function(ev)
				{
					console.log(ev);
					if (ev.type === x11.event.DestroyNotify)
					{
					   self.X.DestroyWindow({window: fid});
					} else if (ev.type == x11.event.ButtonPress) {
						console.log("Drag start");
						dragStart = { rootx: ev.root_x, rooty: ev.root_y, x: ev.event_x, y: ev.event_y, winX: winX, winY: winY };
					} else if (ev.type == x11.event.ButtonRelease) {
						console.log("Drag stop");
						dragStart = null;
					} else if (ev.type == x11.event.MotionNotify) {
						console.log("Drag move");
						if (dragStart !== null) {
							console.log(dragStart);
							winX = dragStart.winX + ev.root_x - dragStart.rootx;
							winY = dragStart.winY + ev.root_y - dragStart.rooty;
							self.X.ConfigureWindow({window:fid, value_mask: { X:winX, Y:winY}});
						}
					}
				});
				self.X.ChangeSaveSet({mode: 1, window: wid});
				self.X.ReparentWindow({window: wid, parent:fid, x:1, y:21});
				self.X.MapWindow({window:fid});
				self.X.MapWindow({window:wid});
			});
		});
	}


}


//exec("xterm");




// "Main"
var wm = new WindowManager();
console.log("Constructor done");

//Object.create(WindowManager);

Fiber(function() {
	x11.createClient(wm.xinit);
}).run();

console.log("Called createClient done");
