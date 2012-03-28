// unpack for static buffer
	
// TODO: use as fallback only if v0.5+ fuffer is not available
// TODO: remove duplicate code

var argument_length = {
	C: 1, // CHAR
	S: 2, // SHORT
	s: 2, // SHORT SIGNED
	L: 4, // LONG
	l: 4, // LONG SIGNED
	x: 1, // ignored byte
	B: 1, // BOOL
	unknown: 1 
};

module.exports.addUnpack = function(Buffer)
{
	Buffer.prototype.unpack = function(format, offset)
	{
		if (!offset)
			offset = 0;

		var data = [];
		var current_arg = 0;
		while (current_arg < format.length)
		{
			var arg = format[current_arg];
			switch (arg) {
			case 'C': 
				data.push(this[offset++]);
				break;
			case 'S':
			case 's': //TODO: 16bit signed unpack
				var b1 = this[offset++];
				var b2 = this[offset++];
				data.push(b2*256+b1);
				break;
			case 'n':
				var b1 = this[offset++];
				var b2 = this[offset++];
				data.push(b1*256+b2);
				break;
			case 'L':
			case 'l': //TODO: 32bit signed unpack
				var b1 = this[offset++];
				var b2 = this[offset++];
				var b3 = this[offset++];
				var b4 = this[offset++];
				data.push(((b4*256+b3)*256 + b2)*256 + b1);
				break;
			case 'B': 
				data.push(this[offset++]);
				break;
			case 'x':
				offset++;
				break;
			}
			current_arg++;
		}
		return data;
	}

	/*  
	Buffer.prototype.skip = function(n)
	{
		offset += n;
	}
	*/

	Buffer.prototype.unpackString = function(n, offset)
	{
		var res = '';
		var end = offset + n;
		while(offset < end)
			res += String.fromCharCode(this[offset++]);
		return res;
	}

	Buffer.prototype.unpackTo = function(destination, names_formats, offset)
	{
		if (!offset)
			offset = 0;

		var names = [];
		var format = '';
		
		for (var i=0; i < names_formats.length; ++i)
		{
			var off = 0;
			while(off < names_formats[i].length && names_formats[i][off] == 'x')
			{
				format += 'x';
				off++;
			}

			if (off < names_formats[i].length)
			{
				format += names_formats[i][off];
				var name = names_formats[i].substr(off+2);
				names.push(name);
			}
		}

		data = this.unpack(format, offset);
		if (data.length != names.length)
			throw 'Number of arguments mismatch, ' + names.length + ' fields and ' + data.length + ' arguments';
		for (var fld = 0; fld < data.length; ++fld)
		{
			destination[names[fld]] = data[fld];
		}
		return destination;
	}
}
