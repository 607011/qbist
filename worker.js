/*
Copyright (c) 2012 Oliver Lau. All rights reserved.
$Id: worker.js 307d964128b8 2012/02/24 12:13:31 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

self.DEBUG = function(msg) {
    self.postMessage({ message: 'debug', info: msg });
}

importScripts('colorspace.js', 'drawoncanvas.js');

self.addEventListener('message', function(e) {
        var d = e.data;
        switch (d.command)
        {
        case 'paint':
            var result = self.optimize(d.transform, d.dest, d.source, d.control);
            d.transform = result.transform;
            d.dest = result.dest;
            d.source = result.source;
            d.control = result.control;
            self.DrawOnCanvas(d);
            break;
        case 'close':
            self.close();
            break;
        default:
            self.DEBUG('Unbekannter Befehl: ' + d.command);
            break;
        };
    }, false);
