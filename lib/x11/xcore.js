var util = require('util'); // util.inherits
var net = require('net');

var handshake = require('./handshake');
//var xevents = require('./xevents');

var EventEmitter = require('events').EventEmitter;
var PackStream = require('./unpackstream');
var coreRequestsTemplate = require('./corereqs');
var hexy = require('./hexy').hexy;

var Buffer = require('buffer').Buffer;
// add 'unpack' method for buffer
require('./unpackbuffer').addUnpack(Buffer);

var os = require('os');

var xevent = require('./event').event;
var xerrors = require('./xerrors');
var coreRequests = require('./corereqs');
var stdatoms = require('./stdatoms');


function XClient(stream, displayNum, screenNum)
{
	EventEmitter.call(this);
	this.stream = stream;

	this.core_requests = {};
	this.ext_requests = {};

	this.displayNum = displayNum;
	this.screenNum = screenNum;
	this.authHost = os.hostname();

	pack_stream = new PackStream();

	// data received from stream is dispached to
	// read requests set by calls to .unpack and .unpackTo
	//stream.pipe(pack_stream);
   
	 // pack_stream write requests are buffered and
	// flushed to stream as result of call to .flush
	// TODO: listen for drain event and flush automatically 
	//pack_stream.pipe(stream);
	
	pack_stream.on('data', function( data ) {
		//console.error(hexy(data, {prefix: 'from packer '}));
		//for (var i=0; i < data.length; ++i)
		//   console.log('<<< ' + data[i]);
		stream.write(data);
	});
	stream.on('data', function( data ) {
		//console.error(hexy(data, {prefix: 'to unpacker '}));
		//for (var i=0; i < data.length; ++i)
		//   console.log('>>> ' + data[i]);
		pack_stream.write(data);
	});

	this.pack_stream = pack_stream;

	this.rcrc_id = 0; // generated for each new resource
	this.seq_num = 0; // incremented in each request. (even if we don't expect reply)
	
	// in/out packets indexed by sequence ID
	//this.requests = {};
	this.replies = {};
	//this.events = {};
	this.atoms = stdatoms;
	this.event_consumers = {}; // maps window id to eventemitter TODO: bad name
	this.importRequestsFromTemplates(this, coreRequests);
	// TODO: this is potentially async and probably has to be synchronised with 'connect' event
	/*
	// import available extentions
	// TODO: lazy import on first call?
	this.ext = {};
	this.ListExtensions( function(err, extentionsList ) {
		for (ext in extentionsList) {
			try {
				X.QueryExtension(ext, function(e) {
					var extRequests = require('./ext/' + extentionsList[ext]);
					importRequestsFromTemplates(this, extRequests);
				});
			} catch (e) {
				// do not import if module not defined
			}
		}
	});    
	*/
	this.startHandshake();
}
util.inherits(XClient, EventEmitter);

// TODO: close() = set 'closing' flag, watch it in replies and writeQueue, terminate if empty
XClient.prototype.terminate = function()
{
	this.stream.end();
}

XClient.prototype.importRequestsFromTemplates = function(target, reqs)
{
	var client = this;
	for (r in reqs)
	{
		// r is request name
		target[r] = (function(reqName) {              
			var reqFunc = function req_proxy() {
			client.seq_num++; // TODO: handle overflow (seq should be last 15 (?)  bits of the number
			// is it fast?
			var args = Array.prototype.slice.call(req_proxy.arguments);

			var callback = args.length > 0 ? args[args.length - 1] : null;
			if (callback && callback.constructor.name != 'Function')
				callback = null;
//console.log('importRequestsFromTemplates: Target=', target, "\nReqs=", reqs, "\nCallback=", callback);

			// TODO: see how much we can calculate in advance (not in each request)
			var reqReplTemplate = reqs[reqName];
			var reqTemplate  = reqReplTemplate[0];
			var templateType = typeof reqTemplate;

			if (templateType == 'object')
				templateType = reqTemplate.constructor.name;

			if (templateType == 'function')
			{
				 // call template with input arguments (not including callback which is last argument TODO currently with callback. won't hurt)
				 //reqPack = reqTemplate.call(args);
				 var reqPack = reqTemplate.apply(this, req_proxy.arguments); 
				 var format = reqPack[0];
				 var requestArguments = reqPack[1];

				 if (callback)
					 this.replies[this.seq_num] = [reqReplTemplate[1], callback];
				 
				 client.pack_stream.pack(format, requestArguments);
				 var b = client.pack_stream.write_queue[0];
				 client.pack_stream.flush();
				 
			} else if (templateType == 'Array'){
				 var format = reqTemplate[0];
				 var requestArguments = [];

				 for (a = 0; a < reqTemplate[1].length; ++a)
					 requestArguments.push(reqTemplate[1][a]);                 
				 for (a in args)
					 requestArguments.push(args[a]);

//                 console.log("Have callback. Replies=", client.replies, "SeqNum=", client.seq_num);
				 if (callback) {
					 client.replies[client.seq_num] = [reqReplTemplate[1], callback];
				}

				 client.pack_stream.pack(format, requestArguments);
				 client.pack_stream.flush();
			} else {
				 throw 'unknown request format - ' + templateType;
			}
		}
		return reqFunc;
		})(r);
	}
}

XClient.prototype.AllocID = function()
{
	// TODO: handle overflow (XCMiscGetXIDRange from XC_MISC ext)
	// TODO: unused id buffer
	this.display.rsrc_id++;
	return (this.display.rsrc_id << this.display.rsrc_shift) + this.display.resource_base;
}

XClient.prototype.unpackEvent = function(type, seq, code, raw)
{
	var event = new XEvent(type, code, seq);
	event.unpack(raw);
	return event;
}

// packetBuf is an optional Buffer
function XEvent(packetBuf)
{
	this.name = '';
	if (packetBuf.unpackTo) {
		this.unpack(packetBuf);
	}
}
XEvent.prototype.unpack = function(raw)
{
	raw.unpackTo(this, [
		'C type',
		'C detail',
		'S seq'
	]);
	this.name = xevent.names[this.type];

	var fieldMap = [
		['L param', 'S majorOpcode', 'C minorOpcode'], // Error
		[], // Reply
		['L time', 'L root', 'L wid', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'B samescreen' ], // KeyPress extra=keycode
		['L time', 'L root', 'L wid', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'B samescreen' ], // KeyRelease extra=keycode
		['L time', 'L root', 'L wid', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'B samescreen' ], // ButtonPress extra=button
		['L time', 'L root', 'L wid', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'B samescreen' ], // ButtonRelease extra=button
		['L time', 'L root', 'L wid', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'B samescreen' ], // MotionNotify extra=normal/hint
		['L time', 'L root', 'L event', 'L child', 's rootx', 's rooty', 's x', 's y', 'S buttons', 'C mode', 'B samescreen' ], // EnterNotify extra=detail
		[], // LeaveNotify
		[], // FocusIn
		[], // FocusOut
		[], // KeymapNotify
		['L wid', 'S x', 'S y', 'S width', 'S height', 'S count'], // Expose
		[], // GraphicsExposure
		[], // NoExposure
		[], // VisibilityNotify
		['L parent', 'L wid', 'S x', 'S y', 'S width', 'S height', 'S border', 'B overrideRedirect'], // CreateNotify
		[], // DestroyNotify
		[], // UnmapNotify
		['L parent', 'L wid', 'B overrideRedirect'], // MapNotify
		['L parent', 'L wid'], // MapRequest
		[], // ReparentNotify
		[], // ConfigureNotify
		[], // ConfigureRequest
		[], // GravityNotify
		[], // ResizeRequest
		[], // CirculateNotify
		[], // CirculateRequest
		[], // PropertyNotify
		[], // SelectionClear
		[], // SelectionRequest
		[], // SelectionNotify
		[], // ColormapNotify
		[], // ClientMessage
		[], // MappingNotify
		[] // GenericEvent
	];
	raw.unpackTo(this, fieldMap[this.type], 4);
}

XClient.prototype.receiveError = function(packetBuf) {
	var client = this;
	var error = new XEvent(packetBuf)
	
	error.code = error.detail;
	error.message = xerrors.errorText[error.code];

	var handler = client.replies[error.seq];
	if (handler) {
		var callback = handler[1];
		callback(error);
		delete client.replies[error.seq];
	} else {
		console.log("Throwing error: ", error, packetBuf);
		client.emit('error', error);
	}
}

XClient.prototype.receiveEvent = function(packetBuf) {
	var client = this;
	var ev = new XEvent(packetBuf);
//	console.log("Unpacked Event: ", ev);

	client.emit('event', ev);
	var ee = client.event_consumers[ev.wid];
	if (ee) {
	   ee.emit('event', ev);
	}
}

XClient.prototype.listenForEvent = function()
{
	// TODO: BigReq!!!!
	var client = this;
	client.pack_stream.get(32, function(packetBuf) {
		var res = packetBuf.unpack('CCSL');
		var type = res[0];
		var opt_data = res[1];
		var seq_num = res[2];
		var replyLength = res[3];

		if (type == 0) {
			client.receiveError(packetBuf);
		} else if (type > 1) {
			client.receiveEvent(packetBuf);
		} else { // Response
			var extralength = replyLength*4; // replyLength includes 32-bytes we've already got
			client.pack_stream.getAppend(extralength, packetBuf, function(data) {
				var handler = client.replies[seq_num];
				if (handler) {
					var unpack = handler[0];
					var result = unpack(data.slice(8), opt_data);
					var callback = handler[1];
					callback(result);
					// TODO: add multiple replies flag and delete handler only after last reply (eg ListFontsWithInfo)
					delete client.replies[seq_num];
				}
			});
		}
		// wait for new packet from server
		client.listenForEvent();
	});
}

XClient.prototype.startHandshake = function()
{
	var client = this;

	handshake.writeClientHello(this.pack_stream, this.displayNum, this.authHost);
	handshake.readServerHello(this.pack_stream, function(display) 
	{
		// TODO: readServerHello can set error state in display
		// emit error in that case
		client.listenForEvent();
		client.display = display;
		display.client = client;
		client.emit('connect', display);
	});   
}

XClient.prototype.require = function(extName, callback)
{
   var ext = require('./ext/' + extName);
   ext.requireExt(this.display, callback);
}

var platformDefaultTransport = {
   win32: 'tcp',
   win64: 'tcp',
   cygwin: 'tcp',
   linux: 'unix'
   // TODO: check process.platform on SmartMachine solaris box
}

module.exports.createClient = function(initCb, display)
{
	if (!display)
	   display = process.env.DISPLAY;
	if (!display)
		display = ':0';

	var displayMatch = display.match(/^(?:[^:]*?\/)?(.*):(\d+)(?:.(\d+))?$/);
	var host = displayMatch[1];
	if (!host)
		host = '127.0.0.1';
	var displayNum = displayMatch[2];
	if (!displayNum)
		displayNum = 0;
	var screenNum = displayMatch[3];
	if (!screenNum)
		screenNum = 0;
	
	// open stream
	var stream;
	var defaultTransportName = platformDefaultTransport[process.platform];
	// use tcp if stated explicitly or if not defined at all
	if (!defaultTransportName || defaultTransportName == 'tcp' || host != '127.0.0.1')
		stream = net.createConnection(6000 + parseInt(displayNum), host);
	if (defaultTransportName == 'unix' && host == '127.0.0.1')
		stream = net.createConnection('/tmp/.X11-unix/X' + displayNum);

	var client = new XClient(stream, displayNum, screenNum);
	if (initCb)
	{
		client.on('connect', function(display) {
			initCb(display);
		});
	} 
	return client;     
}
