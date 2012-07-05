var fs = require('fs');
var Buffer = require('buffer').Buffer;

var EventEmitter = require('events').EventEmitter;
var Future = require('fibers/future'), wait = Future.wait;
var Fiberize = require('fiberize');
var Promise = require('fibers-promise');
var exec = require('child_process').exec;

var x11 = require('x11');
var wid, cidBlack, cidWhite;
var X;

var Window = require('./lib/window.js');



var WindowManager = function() {
	console.log("2 Current Fiber: ", Fiber.current);
	var self = this;
	self.clients = [];
	self.frames = {};
	self.fonts = {};
	self.cursors = {};
	self.X = undefined;
	self.plugins = {};

	self.xinit = function xinit(xserver) {
		console.log("Xinit called");
		self.xserver = xserver;
		self.X = xserver.client;
		self.root = xserver.screen[0].root;
		self.X.listAllAtoms(1);
		while(self.X.__listingAtoms) {
			console.log("Waiting for atoms...");
			self.sleep(100);
		}
		console.log("Done listing atoms");

		self.setupDisplay();
		for(plug in self.plugins) {
			self.plugins[plug].initDisplay();
		}

		self.scanWindows();

		// Do Event Loop
		self.X.on('error', function(err) {
			console.log("Error: ", err);
		}).on('event', function(ev) {
			Fiber(function() {
			switch(ev.type) {
				case x11.event.ConfigureRequest:
					self.X.ConfigureWindow({window: ev.window, value_mask: {Width: ev.width, Height: ev.height}});
					break;
				case x11.event.MapRequest:
					if (!self.frames[ev.window]) {
						self.manageWindow(ev.window);
					}
					break;
				case x11.event.ConfigureNotify:
					if (self.frames[ev.event]) {
						self.frames[ev.event].onConfigureNotify(ev);
					}
					break;
				case x11.event.ButtonPress:
					if (self.frames[ev.event]) {
						self.frames[ev.event].raise();
						self.frames[ev.event].onButtonPress(ev);
					}
					// If we are done grabbing:
					self.X.AllowEvents({mode: x11.Allow.ReplayPointer, time: x11.Time.CurrentTime});
					break;
				case x11.event.ButtonRelease:
					if (self.frames[ev.event]) {
						self.frames[ev.event].onButtonRelease(ev);
					}
					break;
				case x11.event.MotionNotify:
					if (self.frames[ev.event]) {
						self.frames[ev.event].onMotionNotify(ev);
					}
					break;
				case x11.event.DestroyNotify:
					if (self.frames[ev.event]) {
						self.frames[ev.event].onDestroyNotify(ev);
					}
					break;
				default:
					console.log("UnhandledEvent: ", ev);
			}
//			console.log("Main Event: ", ev);
			}).run();
		});
	};

	self.setupDisplay = function setupDisplay() {
		// Here we will eventually also set all of our extended window manager hints for apps to use

		// Define cursors
		self.fonts.cursor = self.X.AllocID();
		self.X.OpenFont({fid: self.fonts.cursor, name: "cursor"});

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
	};

	self.scanWindows = function scanWindows() {
		self.X.QueryTree({window: self.root}, function(tree) {
			console.log("Children tree: ", tree);
			tree.children.forEach(self.manageWindow);
		});
	};

	self.manageWindow = function manageWindow(wid) {
//		Fiber(function() {
			var win = new Window(self, wid);
			self.clients.push(win);
			for(plug in self.plugins) {
				self.plugins[plug].initWindow(win);
			}
//		}).run();
	};

	self.loadPlugin = function(filename) {
		var name = filename.replace('.js', '');
		console.log('Loading plugin: ', name);
		self.plugins[name] = require('./plugins/'+name).load(self);
	};

	self.loadPlugins = function loadPlugins() {
		var files = fs.readdirSync('plugins');
		console.log('Found plugins: ', files);
		var i;
		for(i=0; i<files.length; i++) {
			self.loadPlugin(files[i]);
		}
	};

	self.sleep = function sleep(ms) {
		var fiber = Fiber.current;
		setTimeout(function() {
			fiber.run();
		}, ms);
		Fiber.yield();
	}

	self.loadPlugins();
	console.log("WindowManager.construct finished");
};

WindowManager.prototype.CreateGlyphCursor = function(name, glyph) {
	this.cursors[name] = this.X.AllocID();
	this.X.CreateGlyphCursor({cid: this.cursors[name], 
		source_font: this.fonts.cursor, mask_font: this.fonts.cursor,
		source_char: glyph, mask_char: glyph + 1,
		fore_red: 0, fore_green: 0, fore_blue: 0, back_red: 0xffff, back_green: 0xffff, back_blue: 0xffff});
	return this.cursors[name];
}


var wm = new WindowManager();

// "Main"
x11.createClient(function(client) {
	Fiber(function() {
		wm.xinit(client);
	}).run();
});

console.log("Called Run");
