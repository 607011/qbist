/*
Idea and original code by Jörn Loviscach <jl@j3l7h.de>
Port to JavaScript and optimizations by Oliver Lau <oliver@von-und-fuer-lau.de>
Copyright (c) 1995, 2012 by Jörn Loviscach & Oliver Lau. All rights reserved.
$Id: drawoncanvas.js b27222f46d6b 2012/02/24 13:34:38 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

var inWorker = (typeof window === 'undefined');
if (inWorker) {
    console = {
        log: self.DEBUG
    };
};

var optimize = function(trx, dst, src, ctl, nRegisters) {
    var needed = [ true ], _trx = [], _dst = [], _src = [], _ctl = [], j;
    for (j = 1; j < nRegisters; ++j)
        needed.push(false);
    function addConditionally(t, d, s, c, sources) {
        if (needed[d]) {
            _trx.push(t);
            _dst.push(d);
            _src.push(s);
            _ctl.push(c);
            needed[d] = false;
            for (var i = 0; i < sources.length; ++i)
                needed[sources[i]] = true;
        }
    }
    var i = trx.length;
    while (i--) {
        var t = trx[i];
        var d = dst[i];
        var s = src[i];
        var c = ctl[i];
        switch (t)
        {
        case 0: // fall-through
        case 1: // fall-through
        case 2: // fall-through
        case 5: // fall-through
        case 6: // fall-through
        case 7: addConditionally(t, d, s, c, [ s, c ]); break;
        case 3: // fall-through
        case 4: // fall-through
        case 8: addConditionally(t, d, s, c, [ s ]); break;
        default: // ignore
        }
    }
    // console.log((Math.round((mTransform[variation].length - _trx.length) / mTransform[variation].length * 1000)/10) + '% gespart');
    return {
        transform: _trx.reverse(),
        dest: _dst.reverse(),
        source: _src.reverse(),
        control: _ctl.reverse()
    };
}


var DrawOnCanvas = function(p, synchronous) {
    var trx = p.transform;
    var src = p.source;
    var ctl = p.control;
    var dst = p.dest;
    var lastTransform = trx.length;
    var imgd = p.imageData, pixel_bits = imgd.data;
    var w = imgd.width, h = imgd.height, H = (typeof p.numTiles === 'undefined')? h : h * p.numTiles;
    var tile = p.tile || 0;
    var Y0 = p.Y0 || 0, Y1 = Y0 + h;
    var reg = [], i, j, x, y, pp = 0, xreal, yreal, percent = 0;
    var overlayMethod = p.overlayMethod;
    i = p.NUM_REGISTERS;
    while (i--) reg.push(new Colorspace());
    for (y = Y0; y < Y1; ++y) {
        yreal = y / H;
        if (inWorker) {
            var newPercent = Math.round(100*(y-Y0)/h);
            if (percent != newPercent) {
                percent = newPercent;
                    self.postMessage({ message: 'progress', percent: percent, tile: tile });                
            }
        }
        for (x = 0; x < w; ++x) {
            xreal = x / w;
            var r = pixel_bits[pp]/256, g = pixel_bits[pp+1]/256, b = pixel_bits[pp+2]/256;
            switch (overlayMethod)
            {
            case 'overwrite':
                for (j = 0; j < reg.length; ++j)
                    reg[j].set(xreal, yreal, j/reg.length);
                break;
            case 'copy':
                for (j = 0; j < reg.length; ++j)
                    reg[j].set(r, g, b);
                break;
            case 'multiply':
                for (j = 0; j < reg.length; ++j)
                    reg[j].set(xreal*r, yreal*g, j/reg.length*b);
                break;
            case 'add':
                for (j = 0; j < reg.length; ++j)
                    reg[j].set(xreal+r, yreal+g, j/reg.length+b);
                break;
            case 'subtract':
                for (j = 0; j < reg.length; ++j)
                    reg[j].set(xreal-r, yreal-g, j/reg.length-b);
                break;
            default:
                break;
            }
            for (i = 0; i < lastTransform; ++i) {
                switch (trx[i])
                {
                case 0: reg[dst[i]].project(reg[src[i]], reg[ctl[i]]); break;
                case 1: reg[dst[i]].shift(reg[src[i]], reg[ctl[i]]); break;
                case 2: reg[dst[i]].shiftBack(reg[src[i]], reg[ctl[i]]); break;
                case 3: reg[dst[i]].rotate(reg[src[i]]); break;
                case 4: reg[dst[i]].rotate2(reg[src[i]]); break;
                case 5: reg[dst[i]].multiply(reg[src[i]], reg[ctl[i]]); break;
                case 6: reg[dst[i]].sine(reg[src[i]], reg[ctl[i]]); break;
                case 7: reg[dst[i]].conditional(reg[src[i]], reg[ctl[i]]); break;
                case 8: reg[dst[i]].complement(reg[src[i]]); break;
                }
            }
            pixel_bits[pp++] = reg[0].r();
            pixel_bits[pp++] = reg[0].g();
            pixel_bits[pp++] = reg[0].b();
            pixel_bits[pp++] = 255;
        }
    }
    if (inWorker) {
        self.postMessage({ message: 'painted', imageData: imgd, tile: tile, Y0: Y0, variation: p.variation });
    }
    else {
        if (typeof synchronous === 'boolean' && synchronous == true)
            return imgd;
        else
            self.postMessage({ message: 'painted', imageData: imgd, tile: tile, Y0: Y0, variation: p.variation }, '*');
    }
};
