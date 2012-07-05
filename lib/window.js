var util = require('util'); // util.inherits
var x11 = require('x11');
var EventEmitter = require('events').EventEmitter;
var Pluggable = require('./pluggable');

var X;

var Window = function(wm, wid) {
	var self = this;
	X = self.X = wm.X;
	self.wm = wm;
	self.root = wm.root;
	self.wid = wid;
	self.clientGeom = null;
	self.x = 0;
	self.y = 0;
	self.width = 0;
	self.height = 0;
	self.Background = 0xffffe0;
	self.Border = 0xe0ffff;
	self.name = 'Untitled';
	self.titleHeight = 20;
	self.border = 2;

	self.properties = {};


	self.pointerGrabs = 0;

	this.functionPlugs.call(this, {
		onDestroyNotify: Window.prototype.onDestroyNotify,
		onButtonPress: Window.prototype.onButtonPress,
		onButtonRelease: Window.prototype.onButtonRelease,
		onMotionNotify: Window.prototype.onMotionNotify
	});

	this.init.call(this, wid);
};
util.inherits(Window, EventEmitter);
util.inherits(Window, Pluggable);

Window.prototype.init = function(wid) {
	var self = this;
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
		self.wm.frames[fid] = self;

		self.X.GetGeometry({drawable: wid}, function(clientGeom) {
			self.clientGeom = clientGeom;
			self.width = clientGeom.width;
			self.height = clientGeom.height;
			self.reparent(wid);
		});
	});
}

Window.prototype.onButtonPress = function onButtonPress(ev) {
	if (ev.detail==2) {
		console.log("Window properties: ", this.properties);
	}
//	console.log("Window.onButtonPress: ", ev);
}

Window.prototype.onButtonRelease = function onButtonRelease(ev) {
//	console.log("Window.onButtonRelease: ", ev);
}

Window.prototype.onMotionNotify = function onMotionNotify(ev) {
	// Attempt to fix for when we have ungrabbed pointer but still get motionNotify for child windows
	if (ev.child && this.pointerGrabs==0) {
//		console.log("Still trying to ungrab pointer...");
		this.UngrabPointer();
	}
//	console.log("Window.onMotionNotify: ", ev);
}

Window.prototype.onDestroyNotify = function onDestroyNotify(ev) {
//	console.log("Window.onDestroyNotify: ", ev);
	this.X.DestroyWindow({window: this.fid});
}

Window.prototype.onConfigureNotify = function onConfigureNotify(ev) {
//	console.log("Window.onConfigureNotify: ", ev);
	this.redraw();
}

Window.prototype.reparent = function(wid) {
	self = this;
	// todo: Some sensible positioning logic
	self.x = parseInt(Math.random()*300, 10);
	self.y = parseInt(Math.random()*300, 10);

	var frameAttribs = {
		BackPixel: self.Background,
		BorderPixel: self.Border,
		DontPropagate: x11.EventMask.ButtonPress|x11.EventMask.ButtonRelease|x11.EventMask.ButtonMotion,
		OverrideRedirect: false,
		EventMask: x11.EventMask.ButtonMotion
			|x11.EventMask.PointerMotion
			|x11.EventMask.ButtonPress
			|x11.EventMask.ButtonRelease
			|x11.EventMask.SubstructureNotify
			|x11.EventMask.SubstructureRedirect
			|x11.EventMask.ExposureMask
			|x11.EventMask.EnterWindowMask
			|x11.EventMask.LeaveWindowMask
	};

	self.X.GrabServer();

	self.width = self.clientGeom.width + self.border*4;
	self.height = self.clientGeom.height + self.border*4 + self.titleHeight;

	// if(border_width) { b_w = border_width; XSetWindowBorderWidth(dpy, window, 0); } else { b_w = BW; }

	self.X.CreateWindow({wid: self.fid, parent: self.root, x:self.x, y:self.y, width:self.width, height:self.height, border_width:0, _class:1, visual:0,
		value_mask: frameAttribs });


	self.X.ChangeWindowAttributes({window: wid, value_mask: x11.CW.DontPropagate, value_list: frameAttribs});

//		self.X.ChangeWindowAttributes({window: wid, value_mask: {x11.CW.DontPropagate}, value_list: frameAttribs}); // self.X.SelectInput({window: wid, FocusChangeMask|PropertyChangeMask});
	self.X.ChangeSaveSet({mode: x11.SetMode.Delete, window: wid}); // Why do we do this? Why not AddToSaveSet()? 
	self.X.ReparentWindow({window: wid, parent:self.fid, x:self.border, y:self.border+self.titleHeight});

	self.X.GrabButton({button: x11.ButtonIndex.Any, modifiers: x11.ModMask.Any, grab_window: self.fid, owner_events: true, event_mask: x11.EventMask.ButtonPress|x11.EventMask.ButtonRelease, 
		pointer_mode: x11.GrabMode.Sync, keyboard_mode: x11.GrabMode.Async});

	// SendEvent: ConfigureNotify, StructureNotifyMask

	self.X.UngrabServer();

	Fiber(function() {
	self.X.ListProperties({window: wid}, function(repl) {
		console.log("ListProperties reply: ", repl);
//		var listingProperties = true;
		for (var a=0; a<repl.atoms_len; a++) {
			self.getAtomProperty(self.X.Atom[repl.atoms[a]], function() {
				console.log("Window Properties: ", self.properties);
			});
		}
		console.log("All Window Properties: ", self.properties);
//		self.wm.sleep(100);
	});
}).run();

	self.getAtomProperty(x11.Atom.WM_NAME, function(prop) {
		if (prop.value !== undefined) {
			self.name = prop.value;
		}
		self.redraw();
	});

	self.X.MapWindow({window:self.fid});
	self.X.MapWindow({window:wid});

	self.redraw();
}



Window.prototype.GrabPointer = function(mask, cursor) {
	console.log("GrabPointer for window: " + this.fid);
	this.pointerGrabs++;
	return this.X.GrabPointer({grab_window: this.fid, owner_events: false, event_mask: mask
		, pointer_mode: x11.GrabMode.Async, keyboard_mode: x11.GrabMode.Async, confine_to: 0, cursor: cursor, time: x11.Time.CurrentTime});
}

Window.prototype.UngrabPointer = function() {
//	console.log("UngrabPointer for window: " + this.fid);
	if (this.pointerGrabs>0) { this.pointerGrabs--; }
	return this.X.UngrabPointer({time: x11.Time.CurrentTime});
}

Window.prototype.getGC = function() {
	if (!this.gc) {
		var gc = this.X.AllocID();
		this.X.CreateGC({cid: gc, drawable: this.wid, value_mask: { Foreground: 0, Background: this.Background } });
		this.gc = gc;
		console.log("GC: ", this.gc);
	}
	return this.gc;
}

Window.prototype.getAtomProperty = function(atom, cb) {
	var atomNum = (typeof(atom)==='string' ? self.X.Atom[atom] : atom);
	this.X.GetProperty({_delete: 0, window: this.wid, property: atomNum, type: x11.Atom.STRING, long_offset: 0, long_length: 1000000000}, function(prop) {
		console.log("Got Property: ", prop);
		self.properties[self.X.Atom[atomNum]] = prop.value;
		if (cb) {
			cb(prop);
		}
	});
	return this;
}

// Broken :(
Window.prototype.getProperty = function(name, cb) {
//	nameAtom = x11.Atom.WM_NAME; // _NET_WM_NAME
	self = this;
	this.X.InternAtom({only_if_exists: true, name_len: name.length, name: name}, function(nameAtom) {
		self.X.GetProperty({_delete: 0, window: self.wid, property: nameAtom, type: x11.Atom.STRING, long_offset: 0, long_length: 1000000000}, function(prop) {
			cb(prop);
		});
	});
	return this;
}

Window.prototype.redraw = function() {
	var gc = this.getGC();
	var title = this.name;
	console.log("Redrawing window title: " + title);
	this.X.ImageText8({drawable:this.fid, gc:gc, x:5, y:12, string:title});
}

Window.prototype.raise = function() {
	// Todo, only raise if we're not already on top
	this.X.ConfigureWindow({window: this.fid, value_mask: { StackMode: x11.StackMode.Above } });
}

Window.prototype.move = function(dx, dy, immediate) {
	if (dx || dy)
	{
		this.x += dx;
		this.y += dy;

//		priv->geometry.setX (priv->attrib.x);
//		priv->geometry.setY (priv->attrib.y);

//		priv->region.translate (dx, dy);
//		priv->inputRegion.translate (dx, dy);
//		if (!priv->frameRegion.isEmpty ()) {
//			priv->frameRegion.translate (dx, dy);
//		}
//
//		priv->invisible = WINDOW_INVISIBLE (priv);

//		moveNotify (dx, dy, immediate);
	}
}

Window.prototype.syncPosition = function() {
//    priv->serverGeometry.setX (priv->attrib.x);
//    priv->serverGeometry.setY (priv->attrib.y);

	X.ConfigureWindow({window:this.fid, value_mask: { X: this.x, Y:this.y}});
//    XMoveWindow (screen->dpy (), ROOTPARENT (this),
//		 priv->attrib.x - priv->input.left,
//		 priv->attrib.y - priv->input.top);

//    if (priv->frame)
//    {
//	XMoveWindow (screen->dpy (), priv->wrapper,
//		     priv->input.left, priv->input.top);
//	sendConfigureNotify ();
//    }
}



module.exports = Window;