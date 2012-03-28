
var Buffer = require('buffer').Buffer;

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

function draw()
{
	var whiterects = [];
	var blackrects = [];
	for (var x=0; x < cupsize[0]; ++x)
	{
		for (var y=0; y < cupsize[1]; ++y)
		{
			var index = x + y*cupsize[0];
			var rect = [x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize];
			if (cup[index] != 0)
				blackrects = blackrects.concat(rect);
			else
				whiterects = whiterects.concat(rect);
		}
	}
	var fig = getTransformedFigure(fignum, angle, pos);
	for (var i=0; i < fig.length; i+=2)
	{
		var x = fig[i];
		var y = fig[i+1]
		blackrects = blackrects.concat([x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize]);
	}
	X.PolyFillRectangle(wid, cidWhite, whiterects);
	X.PolyFillRectangle(wid, cidBlack, blackrects);
}


// A resolver that returns the first argument of the callback
Future.prototype.resolver = function() {
		return function(val) {
			this.return(val);
		}.bind(this);
	},



x11.createClient(function(display) {
	Fiber(function() {
	X = display.client;
	var XF = Fiberize(X);
	var p = Promise();

	function AllocNamedColor(colorMap, name) {
		var pro = Promise();
		X.AllocNamedColor(colorMap, name, pro);
		return pro.get();
	}

	var root = display.screen[0].root;
	var white = display.screen[0].white_pixel;
	var black = display.screen[0].black_pixel; 
	var getAtomName = Future.wrap(X.GetAtomName, 1);
	var allocNamedColor = Future.wrap(X.AllocNamedColor, 2);
	var windows = {};

	var name37 = getAtomName(37).wait();
	var name39 = getAtomName(39).wait();

	console.log("White: ", white);
	console.log("Atom 37: ", name37);
	console.log("Atom 39: ", name39);
	console.log("Root: ", root);
	
	var colorMap = display.screen[0].default_colormap;
	console.log("Colormap: ", colorMap);
	var colors = {
		red: AllocNamedColor(colorMap, "Red"),
		green: AllocNamedColor(colorMap, "Green"),
		blue: AllocNamedColor(colorMap, "Blue"),
		black: AllocNamedColor(colorMap, "Black"),
		white: AllocNamedColor(colorMap, "White")
	};
	console.log("Colors: ", colors);

	// Manage Root Window: listen for events, reparent any existing windows
	var rootEventMask = x11.eventMask.SubstructureRedirect | x11.eventMask.SubstructureNotify | x11.eventMask.StructureNotify;
	X.ChangeWindowAttributes(root, { eventMask: rootEventMask });


	//$this->_execute("xsetroot \-mod 16 18 \-fg rgb:54/6/6 \-bg grey20");
//	exec("xsetroot \-mod 16 18 \-fg rgb:54/6/6 \-bg grey20");
	exec("xhello/hello");


	// wid = X.AllocID();
	// X.CreateWindow(wid, root, 0, 0, cupsize[0]*sqsize, cupsize[1]*sqsize, 1, 1, 0, { backgroundPixel: white, eventMask: KeyPress|Exposure });
	// cidBlack = X.AllocID();
	// cidWhite = X.AllocID();
	// X.CreateGC(cidBlack, wid,  { foreground: black, background: white } );
	// X.CreateGC(cidWhite, wid,  { foreground: white, background: black } );
	// X.MapWindow(wid);

	var up = 111;
	var down = 116;
	var left = 113;
	var right = 114;

//TODO keykode -> keysym
/*
	var up = 98;
	var down = 104;
	var left = 100;
	var right = 102;
*/
	X.on('event', function(ev) {
		console.log('Received '+ev.name+' event: ', ev);
		switch(ev.type) {
			case x11.event.CreateNotify:
				if (!ev.overrideRedirect) {
				// 	foreach($this->_core->windows as $win) {
				// 		if ($win->frame == $evt['window']) {
				// 			echo "Configuring Frame {$evt['window']} for window $win->id\n";
				// 			//$win->configureFrame($evt);
				// 			return;
				// 		}
				// 	}
					if (ev.parent == root) {
						windows[ev.wid] = new Window(X, ev);
					}
					console.log("Windows: ", windows);
				}
				break;
			case x11.event.MapRequest:
					console.log("Windows: ", windows);

//				if (windows[ev.wid]) {
					windows[ev.wid].map();
//				}
				break;
			case x11.event.MotionNotify:
				  break;
			case x11.event.Expose:
				  draw(); break;
			case x11.event.KeyPress:
				  //console.log('keycode', ev);
				  //console.log(X.keymap[ev.keycode]);
				  // 111, 113, 114, 116, 65
				  switch(ev.keycode) {            
					  case up: rotateUp(); break;
					  case down: rotateDown(); break;
					  case left: moveLeft(); break;
					  case right: moveRight(); break;
					  case 65: drop(); break;
				  }
				  break;
			default:
				  console.log('default event', ev);
		 }
	});
	console.log('End of createclient Fiber');
	}).run();

	console.log('End of createclient callback');
});