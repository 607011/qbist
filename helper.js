/*
Copyright (c) 2012 Oliver Lau. All rights reserved.
$Id: helper.js 7b780fd8fa1b 2012/03/23 13:52:30 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

function isChromeBrowserEqualOrGreaterThan(version) {
    var result = navigator.appVersion.match(/Chrome\/(\d+)/);
    return result && parseInt(result[1]) >= version;
};

var Browser = {
    Firefox: navigator.userAgent.match(/Firefox/),
    Chrome: navigator.userAgent.match(/Chrome/),
    IE: navigator.userAgent.match(/Explorer/),
    Opera: navigator.userAgent.match(/Opera/),
    Safari: navigator.userAgent.match(/Safari/)
};

var Feature = {
    CheckAll: function() {
        Feature = {
            NaCl: (function() {
                    if (!navigator.plugins && !isChromeBrowserEqualOrGreaterThan(15))
                        return false;
                    // XXX: liefert fälschlicherweise true zurück, wenn Plug-in 
                    // vorhanden, aber nicht aktiv oder kein für die Plattform
                    // geeigneter Code vorhanden. Besser wäre eine Prüfung, ob
                    // ein Dummy-NaCl-Modul erfolgreich geladen wurde.
                    for (var i = 0; i < navigator.plugins.length; ++i)
                        if (navigator.plugins[i].name == 'Native Client')
                            return true;
                    return false;
                })(),
            WebGL: (function() {
                    var canvas = document.getElementById('testcanvas');
                    if (canvas == null) {
                        canvas = document.createElement('canvas');
                        canvas.style.display = 'none';
                        document.body.appendChild(canvas);
                    }
                    var ok = (create3DContext(canvas) != null);
	                document.body.removeChild(canvas);
	                return ok;
                })(),
            FileAPI: window.File && window.FileReader && window.FileList && window.Blob,
            WebWorker: !!window.Worker
        };
    }
};
