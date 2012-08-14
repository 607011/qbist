/*
Idea and original code by Jörn Loviscach <jl@j3l7h.de>
Port to JavaScript and optimizations by Oliver Lau <oliver@von-und-fuer-lau.de>
Copyright (c) 1995, 2012 by Jörn Loviscach & Oliver Lau. All rights reserved.
$Id: colorspace.js 0e874858e0dc 2012/02/19 19:02:42 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

Colorspace = function(x, y, z) {
    this.set(x, y, z);
};

Colorspace.prototype.set = function(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
}

Colorspace.prototype.r = function() { return (0xfe*this.x) & 0xff; };

Colorspace.prototype.g = function() { return (0xfe*this.y) & 0xff; };

Colorspace.prototype.b = function() { return (0xfe*this.z) & 0xff; };

Colorspace.prototype.project = function(source, control) {
	var dot = source.x * control.x + source.y * control.y + source.z * control.z;
	this.x = dot * source.x;
	this.y = dot * source.y;
	this.z = dot * source.z;
};

Colorspace.prototype.shift = function(source, control) {
	this.x = source.x + control.x;
	this.y = source.y + control.y;
	this.z = source.z + control.z;
	if (this.x >= 1)
		this.x -= 1;
	if (this.y >= 1)
		this.y -= 1;
	if (this.z >= 1)
		this.z -= 1;
};

Colorspace.prototype.shiftBack = function(source, control) {
	this.x = source.x - control.x;
	this.y = source.y - control.y;
	this.z = source.z - control.z;
	if (this.x <= 0)
		this.x += 1;
	if (this.y <= 0)
		this.y += 1;
	if (this.z <= 0)
		this.z += 1;
};

Colorspace.prototype.rotate = function(source) {
	this.x = source.y;
	this.y = source.z;
	this.z = source.x;
};

Colorspace.prototype.rotate2 = function(source) {
	this.x = source.z;
	this.y = source.x;
	this.z = source.y;
};

Colorspace.prototype.multiply = function(source, control) {
	this.x = source.x * control.x;
	this.y = source.y * control.y;
	this.z = source.z * control.z;
};

Colorspace.prototype.sine = function(source, control) {
	this.x = 0.5 + 0.5 * Math.sin(20 * source.x * control.x);
	this.y = 0.5 + 0.5 * Math.sin(20 * source.y * control.y);
	this.z = 0.5 + 0.5 * Math.sin(20 * source.z * control.z);
};

Colorspace.prototype.conditional = function(source, control) {
	if (control.x + control.y + control.z > 0.5) {
		this.x = source.x;
		this.y = source.y;
		this.z = source.z;
	}
	else {
		this.x = control.x;
		this.y = control.y;
		this.z = control.z;
	}
};

Colorspace.prototype.complement = function(source) {
	this.x = 1 - source.x;
	this.y = 1 - source.y;
	this.z = 1 - source.z;
};
