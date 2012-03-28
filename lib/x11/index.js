var core = require('./xcore');
var em = require('./eventmask').eventMask;
var keysyms = require('./keysyms');
var event = require('./event').event;

module.exports.createClient = core.createClient;
module.exports.eventMask = em;
module.exports.event = event;
module.exports.keySyms = keysyms;