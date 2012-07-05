function Pluggable() {
//	this.plugs = {};
}
Pluggable.prototype.functionPlugs = function(funcs) {
	var f;
	var _self = this;

	if (!_self.plugs) {
		_self.plugs = {
			prepend: function(name, fun) {
				_self.plugs[name].stack.unshift(fun);
			}
		};
	}

	var initStack = function(fname) {
		_self[fname] = function() {
			_self.plugs[fname].stack[_self.plugs[fname].stackPtr++].apply(_self, arguments);
			_self.plugs[fname].stackPtr--;
		};
	};

	for(f in funcs) {
		_self.plugs[f] = {
			stack: [funcs[f]],
			stackPtr: 0
		};
		initStack(f);
	}
};

module.exports = Pluggable;