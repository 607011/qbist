/*
Idea and original code by Jörn Loviscach <jl@j3l7h.de>
Port to JavaScript by Oliver Lau <oliver@von-und-fuer-lau.de>
Copyright (c) 1995, 2012 by Jörn Loviscach & Oliver Lau. All rights reserved.
$Id: qbist.js 86a432db15aa 2012/04/23 15:07:04 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

dojo.require("dojo.window");
dojo.require("dojo.fx");

var Stopwatch = function() {}
Stopwatch.prototype.start = function() { this.t0 = Date.now(); }
Stopwatch.prototype.stop = function() { return Date.now() - this.t0; }

var Storage = {
    isAvailable: !!localStorage,
    set: function(key, value) {
        if (typeof value === 'object')
            value = JSON.stringify(value);
        localStorage.setItem(key, value);
    },
    get: function(key) {
        var value = localStorage.getItem(key) || '{}';
        if (value[0] == '{') // Objektliteral annehmen
            return JSON.parse(value);
        return value;
    }
};


var Async = { 
    call: function(fn) {
        setTimeout(fn, 0);
    }
};


var ParameterSet = function(trx, dst, src, ctl, variation) {
    function clone(param) {
        var result = [];
        for (var i = 0; i < param.length; ++i) {
            var inner = [];
            var row = param[i];
            for (var j = 0; j < row.length; ++j)
                inner.push(row[j]);
            result.push(inner);
        }
        return result;
    };
    this.transform = clone(trx);
    this.dest = clone(dst);
    this.source = clone(src);
    this.control = clone(ctl);
    this.variation = variation;    
};

ParameterSet.prototype.toString = function() {
    function _(key, param) {
        var result = '"' + key + '": [';
        for (var i = 0; i < param.length; ++i)
            result += param[i].join(',')
        return result + ']';
    };
    return '{' +
		[ '"variation": ' + (this.variation || 0),
            _('transform', this.transform),
			_('dest', this.dest),
			_('source', this.source),
			_('control', this.control) ].join(', ') + '}';
}


var History = (function() {
    var mHistory = [ /* ParameterSet */ ];
    var mCurrentIndex = undefined;
    function hasPrevious() {
        return typeof mCurrentIndex === 'number' && mCurrentIndex > 0;
    }
    function hasNext() {
        return typeof mCurrentIndex === 'number' && mCurrentIndex < mHistory.length-1;
    }
    function updateNavigationButtons() {
        dojo.byId('history_prev').disabled = !hasPrevious();
        dojo.byId('history_next').disabled = !hasNext();
    }
    return {
        Init: function() {
            updateNavigationButtons();
        },
        Add: function(params) {
            if (typeof mCurrentIndex !== 'undefined' && mCurrentIndex < mHistory.length-1) {
                console.log([ 'before slice', mCurrentIndex, mHistory.length ]);
                mHistory = mHistory.slice(0, mCurrentIndex+1);
                console.log([ 'after slice', mCurrentIndex, mHistory.length ]);
            }
            mHistory.push(params);
            mCurrentIndex = mHistory.length-1;
            updateNavigationButtons();
        },
        Previous: function() {
            if (hasPrevious())
                --mCurrentIndex;
            else
                return null;
            updateNavigationButtons();
            return this.Current();
        },
        Next: function() {
            if (hasNext())
                ++mCurrentIndex;
            else
                return null;
            updateNavigationButtons();
            return this.Current();
        },
        Current: function() {
            var result = (typeof mCurrentIndex === 'number' && mCurrentIndex >= 0 && mCurrentIndex < mHistory.length)? mHistory[mCurrentIndex] : null;
            return result;
        },
        Clear: function() {
            mHistory = [];
            mCurrentIndex = undefined;
            updateNavigationButtons();
        }
    };
})();


var Qbist = (function() {
    var /* const */ TOTAL_TRANSFORMS = 9;
    var /* const */ NUM_VARIATIONS = 8;
    var /* const */ NUM_TRANSFORMS = 36;
    var /* const */ NUM_REGISTERS = 6;
    var /* const */ CHOOSE = 'auswählen ...';
    var /* const */ DUMMY_IMAGE = 'dummy.gif';
    var mNaClEnabled;
    var mWebGLEnabled;
    var mWebWorkerEnabled;
    var i;
    var _preloadImages = [ 'icons.gif', 'loader-icon-16x16.png' ];
    for (i in _preloadImages) {
        var preloaded = new Image();
        preloaded.src = _preloadImages[i];
    }
    var mBaseImage = (function() {
            var img = new Image();
            img.src = DUMMY_IMAGE;
            return img;
        })();
    var mTransform = []; i = NUM_VARIATIONS;
    while (i--) mTransform.push(new Array(NUM_TRANSFORMS));
    var mSource = []; i = NUM_VARIATIONS;
    while (i--) mSource.push(new Array(NUM_TRANSFORMS));
    var mControl = []; i = NUM_VARIATIONS;
    while (i--) mControl.push(new Array(NUM_TRANSFORMS));
    var mDest = []; i = NUM_VARIATIONS;
    while (i--) mDest.push(new Array(NUM_TRANSFORMS));
    var mModule = new Array(NUM_VARIATIONS);
    var mListener = new Array(NUM_VARIATIONS);
    var mCanvas = new Array(NUM_VARIATIONS);
    var mScaleOverlay = new Array(NUM_VARIATIONS);
    var mScaleModule = null;
    var mImExOverlay = new Array(NUM_VARIATIONS);
    var mSaveOverlay = new Array(NUM_VARIATIONS);
    var mModulesLoaded = 0;
    var mPreviewSize = { w: 256, h: 256 };
    var mPictureSize = { w: undefined, h: undefined };
    var mPicturePad = { x: 20, y: 20 };
    var mPictureOverlay = null;
    var mSelectedVariation = undefined;
    var mStopwatch = new Stopwatch();
    var mHighlights = {};
    function moduleDidLoad(e) {
        if (++mModulesLoaded == NUM_VARIATIONS)
            Qbist.PostToAllModules();
    }
    function rand(x) { return Math.floor(x*Math.random()); }
    function updatePictureSize() {
        mPictureSize = { w: parseInt(dojo.byId('width').value), h: parseInt(dojo.byId('height').value) };
    }
    function startTimer() {
        mStopwatch.start();
    }
    function stopTimer() {
        dojo.byId('time').innerHTML = mStopwatch.stop() + '&nbsp;ms';
    }
    function proceedWithVariation(variation) {
        scrollToTop();
        markVariation(0);
        Qbist.SelectMainVariation(variation);
        Qbist.MakeVariations();
        Qbist.PostToAllModules();
        addParametersToHistory();
    }
    function handleMessageFromModule(e) {
        var d = (typeof e.data === 'string')? JSON.parse(e.data) : e.data;
        switch (d.message) {
        case 'painted':
            stopTimer();
            if (mNaClEnabled || mWebGLEnabled) {
                mScaleOverlay[d.variation].setAttribute('style', 'background-color: rgba(255, 255, 255, 0.6); background-position: -16px 0; background-image: url(icons.gif)');
            }
            else {
                if (mScaleOverlay[d.variation].parentNode)
                    mScaleOverlay[d.variation].parentNode.removeChild(mScaleOverlay[d.variation]);
                if (!mWebGLEnabled)
                    mCanvas[d.variation].getContext('2d').putImageData(d.imageData, 0, 0);
            }
            mImExOverlay[d.variation].setAttribute('style', 'background-color: rgba(255, 255, 255, 0.6); background-position: 0 0; background-image: url(icons.gif)');
            mSaveOverlay[d.variation].setAttribute('style', 'background-color: rgba(255, 255, 255, 0.6); background-position: -32px 0; background-image: url(icons.gif)');
            break;
        case 'progress':
            // ignorieren
            break;
        case 'click':
            proceedWithVariation(d.variation);
            break;
        case 'debug':
            console.log('[DEBUG] ' + d.info);
            break;
        default:
            console.log(d);
            break;
        }
    }
    function restoreScaleOverlay(i) {
        dojo.place(mScaleOverlay[i], 'imexovl' + i, 'before');
        mImExOverlay[i].setAttribute('style', 'background: none');
        mSaveOverlay[i].setAttribute('style', 'background: none');
    }
    function postToModule(variation, module) {
        var data = {
            command: 'paint',
            variation: variation,
            NUM_REGISTERS: NUM_REGISTERS,
            overlayMethod: dojo.byId('overlaymethod').value
        };
        if (!mNaClEnabled && !mWebGLEnabled) {
            restoreScaleOverlay(variation);
            if (Feature.FileAPI)
                mCanvas[variation].getContext('2d').drawImage(mBaseImage, 0, 0, mPreviewSize.w, mPreviewSize.h);
            data.imageData = mCanvas[variation].getContext('2d').getImageData(0, 0, mPreviewSize.w, mPreviewSize.h);
            var result = optimize(mTransform[variation], mDest[variation], mSource[variation], mControl[variation], NUM_REGISTERS);
            data.transform = result.transform;
            data.dest = result.dest;
            data.source = result.source;
            data.control = result.control;
        }
        if (mWebGLEnabled) {
            generateShaderCode(variation);
        }
        else if (mNaClEnabled) {
            data.threadcount = dojo.byId('threadcount').value;
            data.transform = mTransform[variation];
            data.dest = mDest[variation];
            data.source = mSource[variation];
            data.control = mControl[variation];
            module.postMessage(JSON.stringify(data));
        }
        else if (mWebWorkerEnabled) {
            if (isChromeBrowserEqualOrGreaterThan(17))
                module.webkitPostMessage(data);
            else
                module.postMessage(data);
        }
        else {
            Async.call(function(){ DrawOnCanvas(data); });
        }
    };
    function saveFile(dataUri) {
		document.location.href = dataUri;
	}
    function updateScaleButtonTitles() {
        for (var i in mScaleOverlay)
            mScaleOverlay[i].title = 'Variation ' + i + ' vergrößern auf ' + mPictureSize.w + ' × ' + mPictureSize.h + ' ...';
    }
    function markVariation(variation) {
        for (var v = 0; v < NUM_VARIATIONS; ++v)
            mListener[v].className = (v == variation)? 'canvas marked' : 'canvas';
    }
    function scrollToTop() {
        Qbist.ScrollTo(0);
    }
    function generateInitialTransform() {
        for (var i = 0; i < NUM_TRANSFORMS; ++i) {
            mTransform[0][i] = rand(TOTAL_TRANSFORMS);
            mSource[0][i] = rand(NUM_REGISTERS);
            mControl[0][i] = rand(NUM_REGISTERS);
            mDest[0][i] = rand(NUM_REGISTERS);
        }
    }
    function resizePictureOverlay() {
        if (mPictureOverlay == null)
            return;
        var newWidth = window.innerWidth-mPicturePad.x;
        var newHeight = window.innerHeight-mPicturePad.y;
        if (newWidth > mPictureSize.w) 
            newWidth = mPictureSize.w;
        if (newHeight > mPictureSize.h) 
            newHeight = mPictureSize.h;
        mPictureOverlay.setAttribute('style', 'width:'+newWidth+'px;height:'+newHeight+'px;');
    }
    function resizeImportExportBox() {
        var rect = dojo.window.getBox();
        var numTilesX = Math.floor((rect.w-2*5-5)/(mPreviewSize.w+4));
        dojo.style('importexport', 'width', (numTilesX*(mPreviewSize.w+4)-2*5-5)+'px');
    }
    function animateImportExportBox() {
        var anim1 = dojo.animateProperty({
                node: 'console',
                easing: function(n){ return 2*n-n*n; },
                duration: 600,
                properties: { backgroundColor: '#cc3333' }
            });
        var anim2 = dojo.animateProperty({
                node: 'console',
                easing: function(n) { return n*n; },
                duration: 600,
                properties: { backgroundColor: '#eeeeee' }
            });
        dojo.fx.chain([anim1, anim2]).play();
    }
    function fadeInPictureOverlay() {
        mPictureOverlay.setAttribute('style', 'display: block; opacity: 0');
        var anim1 = dojo.animateProperty({
                node: mPictureOverlay,
                properties: { opacity: 1 },
                duration: 250
            });
        var anim2 = dojo.animateProperty({
                node: 'body',
                properties: { opacity: 0.2 },
                duration: 250
            });
        dojo.fx.combine([anim1, anim2]).play();
    }
    function fadeOutPictureOverlay() {
        var anim1 = dojo.animateProperty({
                node: 'body',
                properties: { opacity: 1 },
                duration: 250
            });
        var anim2 = dojo.animateProperty({
                node: mPictureOverlay,
                properties: { opacity: 0 },
                duration: 250,
                onEnd: function() { mPictureOverlay.setAttribute('style', 'display: none'); }
            });
        dojo.fx.combine([anim1, anim2]).play();
    }
    function handleDragLeaveConsole(e) {
        dojo.animateProperty({
                node: 'console',
                easing: function(n) { return n*n; },
                properties: { backgroundColor: '#eee' },
                duration: 200
            }).play();
        e.stopPropagation();
        e.preventDefault();
    }
    function handleDragOverConsole(e) {
        dojo.style('console', 'background-color', '#3f3');
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
    function handleFileSelectConsole(e) {
        e.stopPropagation();
        e.preventDefault();
        dojo.animateProperty({
                node: 'console',
                properties: { backgroundColor: '#eee' },
                duration: 200
            }).play();
        var files = e.dataTransfer.files;
        if (files.length == 0)
            return;
        var f = files[0];
        var reader = new FileReader();
        if (f.name.match(/\.qbe$/i)) {
            reader.onload = function(e) {
                    function readArray(first, last, arraybuffer) {
                        var d = [], buffer = new Uint16Array(arraybuffer);
                        for (var i = first; i < last; ++i)
                            d.push((buffer[i] >> 8) + ((buffer[i] & 0xff) << 8)); // JavaScript hat eine andere Byte-Order als das in der Datei abgespeicherte DWORD!
                        return d;
                    }
                    if (e.target.readyState == FileReader.DONE) {
                        mTransform[0] = readArray(36*0, 36*1, e.target.result);
                        mSource[0]    = readArray(36*1, 36*2, e.target.result);
                        mControl[0]   = readArray(36*2, 36*3, e.target.result);
                        mDest[0]      = readArray(36*3, 36*4, e.target.result);
                        Qbist.MakeVariations();
                        Qbist.PostToAllModules();
                        Qbist.Export();
                        Qbist.ResetHighlightSelection();
                    }
                };
            reader.readAsArrayBuffer(f);
        }
        else if (f.name.match(/\.(json|txt)$/i)) {
            reader.onload = function(e) {
                    if (e.target.readyState == FileReader.DONE) {
                        var d = JSON.parse(e.target.result);
                        mTransform[0] = d.transform;
                        mSource[0]    = d.source;
                        mControl[0]   = d.control;
                        mDest[0]      = d.dest;
                        Qbist.MakeVariations();
                        Qbist.PostToAllModules();
                        Qbist.Export();
                        Qbist.ResetHighlightSelection();
                    }
                };
            reader.readAsText(f);
        }
        else {
            alert('Falscher Dateityp! Nur QBE- und JSON-Dateien können hier abgelegt werden.');
        }
    }
    function handleFileSelect(e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.dataTransfer.files;
        if (files.length == 0)
            return;
        var f = files[0];
        if (f.type.match(/image.(jpg|jpeg|png|gif)/i)) {
            var reader = new FileReader();
            reader.onload = function(e) {
                    if (e.target.readyState == FileReader.DONE) {
                        mBaseImage.onload = function() {
                                dojo.byId('overlaymethod').selectedIndex = 2;
                                Qbist.PostToAllModules();
                            };
                        mBaseImage.src = e.target.result;
                    }
                };
            reader.readAsDataURL(f);
        }
        else {
            alert('Falscher Dateityp! Nur JPG, PNG und GIF können hier abgelegt werden.');
        }
    }
    function handleDragOver(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
    function generateModuleElements() {
        for (var i = 0; i < NUM_VARIATIONS; ++i) {
            mListener[i] = dojo.create('span');
            mListener[i].id = 'listener' + i;
            mListener[i].className = 'canvas';
            mListener[i].addEventListener('mouseover', function() { this.style.borderColor = 'red' });
            mListener[i].addEventListener('mouseout', function() { this.style.borderColor = 'white' });
            mListener[i].title = 'Variation ' + i + ' auswählen ...';
            if (Feature.FileAPI && !mNaClEnabled) {
                mListener[i].addEventListener('dragover', handleDragOver, false);
                mListener[i].addEventListener('drop', handleFileSelect, false);
            }
            if (mNaClEnabled) {
                mListener[i].addEventListener('load', moduleDidLoad, true);
            }
            else {
                mCanvas[i] = dojo.create('canvas');
                mCanvas[i].id = 'canvas' + i;
                mCanvas[i].width = mPreviewSize.w;
                mCanvas[i].height = mPreviewSize.h;
                dojo.style(mCanvas[i], 'cursor', 'pointer');
                mCanvas[i].addEventListener('click', dojo.hitch({ variation: i }, function() {
                        // TODO: nur Linksklicks auswerten
                        proceedWithVariation(this.variation);
                    }), true);
            }
            mScaleOverlay[i] = dojo.create('span');
            mScaleOverlay[i].id = 'overlay' + i;
            mScaleOverlay[i].className = 'overlay scaleoverlay';
            mScaleOverlay[i].title = 'Generieren ...';
            mScaleOverlay[i].addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(255,255,255,1)' });
            mScaleOverlay[i].addEventListener('mouseout', function() { this.style.backgroundColor = 'rgba(255,255,255,0.6)' });
            if (mNaClEnabled || mWebGLEnabled) {
                mScaleOverlay[i].addEventListener('click', dojo.hitch({ variation: i }, function() {
                        mSelectedVariation = this.variation;
                        updatePictureSize();
                        var rect = dojo.window.getBox();
                        resizePictureOverlay();
                        fadeInPictureOverlay();
                        if (mScaleModule == null) {
                            var ovlWidth = window.window.innerWidth-mPicturePad.x;
                            var ovlHeight = window.window.innerHeight-mPicturePad.y;
                            if (ovlWidth > mPictureSize.w)
                                ovlWidth = mPictureSize.w;
                            if (ovlHeight > mPictureSize.h)
                                ovlHeight = mPictureSize.h;
                            if (mWebGLEnabled) {
                                mScaleModule = dojo.create('canvas');
                                mScaleModule.id = 'qbist_scaled_picture';
                                mScaleModule.width = mPictureSize.w;
                                mScaleModule.height = mPictureSize.h;
                                mScaleModule.setAttribute('style', 'width: ' + ovlWidth + 'px; height: ' + ovlHeight + 'px');
                                mScaleModule.className = 'module';
                                mScaleModule.addEventListener('click', function() {
                                        window.removeEventListener('resize', resizePictureOverlay); // ???
                                        fadeOutPictureOverlay();
                                    }, true);
                                dojo.place(mScaleModule, mPictureOverlay, 'only');
                            }
                            else if (mNaClEnabled) {
                                mPictureOverlay.addEventListener('load', function() {
                                        startTimer();
                                        postToModule(mSelectedVariation, mScaleModule);
                                    }, true);
                                mScaleModule = dojo.create('embed');
                                mScaleModule.id = 'qbist_scaled_picture';
                                mScaleModule.src = 'qbist_www.nmf';
                                mScaleModule.type = 'application/x-nacl';
                                mScaleModule.width = mPictureSize.w;
                                mScaleModule.height = mPictureSize.h;
                                mScaleModule.className = 'module';
                                mScaleModule.addEventListener('message', function (e) {
                                        var d = JSON.parse(e.data);
                                        if (d.message == 'painted') {
                                            stopTimer();
                                        }
                                        else if (d.message == 'click') {
                                            window.removeEventListener('resize', resizePictureOverlay); // ???
                                            fadeOutPictureOverlay();
                                        }
                                    }, false);
                                dojo.place(mScaleModule, mPictureOverlay, 'only');
                            }
                        }
                        else {
                            mScaleModule.width = mPictureSize.w;
                            mScaleModule.height = mPictureSize.h;
                        }
                        if (mWebGLEnabled) {
                            startTimer();
                            generateShaderCode(mSelectedVariation, mScaleModule);
                        }
                        window.addEventListener('resize', resizePictureOverlay);
                    }), true);
            }
            mImExOverlay[i] = dojo.create('span');
            mImExOverlay[i].id = 'imexovl' + i;
            mImExOverlay[i].title = 'Daten der Variation ' + i + ' im JSON-Format exportieren ...';
            mImExOverlay[i].className = 'overlay imexoverlay';
            mImExOverlay[i].addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(255,255,255,1)' });
            mImExOverlay[i].addEventListener('mouseout', function() { this.style.backgroundColor = 'rgba(255,255,255,0.6)' });
            mImExOverlay[i].addEventListener('click', dojo.hitch({ variation: i }, function() {
                    markVariation(this.variation);
                    Qbist.Export(this.variation);
                    Qbist.ScrollTo(dojo.position('importexport').y);
                    animateImportExportBox();
                }), true);
            mSaveOverlay[i] = dojo.create('span');
            mSaveOverlay[i].id = 'saveovl' + i;
            mSaveOverlay[i].title = 'Variation ' + i + ' im Großformat als PNG generieren ...';
            mSaveOverlay[i].className = 'overlay saveoverlay';
            mSaveOverlay[i].addEventListener('mouseover', function() { this.style.backgroundColor = 'rgba(255,255,255,1)'; });
            mSaveOverlay[i].addEventListener('mouseout', function() { this.style.backgroundColor = 'rgba(255,255,255,0.6)'; });
            mSaveOverlay[i].addEventListener('click', dojo.hitch({ variation: i }, function() {
                    Qbist.DrawTheBigThingOnACanvas(this.variation);
                }), true);
            if (mNaClEnabled) {
                mModule[i] = dojo.create('embed');
                mModule[i].src = 'qbist_www.nmf';
                mModule[i].type = 'application/x-nacl';
                mModule[i].width = mPreviewSize.w;
                mModule[i].height = mPreviewSize.h;
                mModule[i].variation = i;
            }
            else if (mWebWorkerEnabled) {
                mModule[i] = new Worker('worker.js');
                mModule[i].addEventListener('error', dojo.hitch({ variation: i }, function(e) {
                        console.log('[ERROR]: Worker #' + this.variation + ', line ' + e.lineno + ' in ' +  e.filename + ': ' + e.message);
                    }), false);
            }
            if (mModule[i]) {
                mModule[i].addEventListener('message', handleMessageFromModule, false);
                mModule[i].id = 'qbist' + i;
                mModule[i].className = 'module';
            }
            dojo.place(mNaClEnabled? mModule[i] : mCanvas[i], mListener[i]);
            dojo.place(mScaleOverlay[i], mListener[i]);
            dojo.place(mImExOverlay[i], mListener[i]);
            dojo.place(mSaveOverlay[i], mListener[i]);
            dojo.place(mListener[i], 'showroom', 'child');
            updateScaleButtonTitles();
        }
    }
    function generateHighlightSelection() {
        var select = dojo.byId('highlightselector');
        dojo.empty(select);
        select.onchange = function() {
                if (this.value)
                    Qbist.Import(unescape(this.value));
            };
        var option = dojo.create('option');
        option.innerHTML = CHOOSE;
        option.value = '';
        dojo.place(option, select, 'child');
        for (var idx in mHighlights) {
            option = dojo.create('option');
            option.innerHTML = idx;
            option.value = escape(JSON.stringify(mHighlights[idx]));
            dojo.place(option, select, 'child');
        }
    }
    function mergeLocalStorageIntoHighlights() {
        if (!Storage.isAvailable)
            return;
        var localHighlights = Storage.get('highlights');
        for (var idx in localHighlights)
            mHighlights[idx] = localHighlights[idx];
    }
    function loadHighlights() {
        dojo.xhrGet({
            url: 'bestof.json',
            handleAs: 'json',
            load: function(highlights) {
                mHighlights = highlights;
                mergeLocalStorageIntoHighlights();
                generateHighlightSelection();
            }
        });
    }
    function addParametersToHistory() {
        History.Add(new ParameterSet(mTransform, mDest, mSource, mControl, mSelectedVariation));
    }
    function setParameters(params) {
        if (typeof params === 'undefined' || params == null)
            return;
        mTransform = params.transform;
        mDest = params.dest;
        mSource = params.source;
        mControl = params.control;
        markVariation(params.variation);
        Qbist.PostToAllModules();
    }
    function generateShaderCode(variation, targetCanvas) {
        var data = optimize(mTransform[variation], mDest[variation], mSource[variation], mControl[variation], NUM_REGISTERS);
        var i;
        var overlayMethod = dojo.byId('overlaymethod').value;
        var useImage = (mBaseImage.src.indexOf('data:') == 0) && (overlayMethod != 'overwrite');
        if (!useImage) overlayMethod = 'overwrite';
        dojo.byId('shader-vs').text = '// vertex shader\n' +
            ((useImage)
            ? (
            'attribute vec2 aTexCoord;\n' +
            'varying vec2 vTexCoord;\n' )
            : '') +
            'attribute vec4 aColor;\n' +
            'attribute vec4 aPosition;\n' +
            'varying vec4 vColor;\n' +
            'void main() {\n' +
            '    gl_Position = vec4(aPosition.xyz, 1.0);\n' +
            ((useImage)
            ? ( 
            '    vTexCoord.x = aTexCoord.x;\n' +
            '    vTexCoord.y = 1.0 - aTexCoord.y;\n' )
            : '')  +
            '    vColor = aColor;\n' +
            '}';
        var shaderCode = '// fragment shader\n' +
            'precision highp float;\n' +
            ((useImage)
            ? (
            'uniform sampler2D uImage;\n' +
            'varying vec2 vTexCoord;\n' )
            : '') +
            'varying vec4 vColor;\n' +
            'void main() {\n' +
            '    const int NUM_REGS = ' + NUM_REGISTERS + ';\n' +
            '    vec3 reg[NUM_REGS];\n' +
            ((useImage)
            ? (
            '    vec3 textureColor = texture2D(uImage, vTexCoord).rgb;\n')
            : '');
        for (i = 0; i < NUM_REGISTERS; ++i) {
            switch (overlayMethod)
            {
            case 'copy':
                shaderCode += '    reg[' + i + '] = textureColor;\n';
                break;
            case 'multiply':
                shaderCode += '    reg[' + i + '] = textureColor * vec3(vColor.rg, ' + i + '.0 / float(NUM_REGS));\n';
                break;
            case 'add':
                shaderCode += '    reg[' + i + '] = (textureColor + vec3(vColor.rg, ' + i + '.0 / float(NUM_REGS))) * vec3(0.5, 0.5, 0.5);\n';
                break;
            case 'subtract':
                shaderCode += '    reg[' + i + '] = textureColor - vec3(vColor.rg, ' + i + '.0 / float(NUM_REGS));\n';
                break;
            case 'overwrite':
                shaderCode += '    reg[' + i + '] = vec3(vColor.rg, ' + i + '.0 / float(NUM_REGS));\n';
                break;
            default:
                break;
            }
        }
        for (var i = 0; i < data.transform.length; ++i) {
            var d = data.dest[i];
            var s = data.source[i];
            var c = data.control[i];
            switch (data.transform[i])
            {
            case 0:
                shaderCode += '    // projection\n' +
                    '    reg[' + d + '] = dot(reg[' + s + '], reg[' + c + ']) * reg[' + s + '];\n';
                break;
            case 1:
                 shaderCode += '    // shift\n' +
                    '    reg[' + d + '] = reg[' + s + '] + reg[' + c + '];\n' +
                    '    reg[' + d + '] -= vec3(greaterThanEqual(reg[' + d + '], vec3(1.0, 1.0, 1.0)));\n';
                break;
            case 2:
                 shaderCode += '    // shiftBack\n' +
                    '    reg[' + d + '] = reg[' + s + '] - reg[' + c + '];\n' +
                    '    reg[' + d + '] += vec3(lessThanEqual(reg[' + d + '], vec3(0.0, 0.0, 0.0)));\n';
                break;
            case 3:
                shaderCode += '    // rotate\n' +
                    '    reg[' + d + '] = vec3(reg[' + s + '].gb, reg[' + s + '].r);\n';
                break;
            case 4:
                shaderCode += '    // rotate2\n' +
                    '    reg[' + d + '] = vec3(reg[' + s + '].b, reg[' + s + '].rg);\n';
                break;
            case 5:
                shaderCode += '    // multiply\n' +
                    '    reg[' + d + '] = reg[' + s + '] * reg[' + c + '];\n';
                break;
            case 6:
                shaderCode += '    // sine\n' +
                    '    reg[' + d + '] = 0.5 + 0.5 * sin(20.0 * reg[' + s + '] * reg[' + c + ']);\n';
                break;
            case 7:
                shaderCode += '    // conditional\n' +
                    '    if ((reg[' + c + '].r + reg[' + c + '].g + reg[' + c + '].b) > 0.5) {\n' +
                    '        reg[' + d + '] = reg[' + s + '];\n' +
                    '    }\n' +
                    '    else {\n' +
                    '        reg[' + d + '] = reg[' + c + '];\n' +
                    '    }\n';
                break;
            case 8:
                shaderCode += '    // complement\n' +
                    '    reg[' + d + '] = 1.0 - reg[' + s + '];\n';
                break;
            }
        }
        shaderCode += '\n    gl_FragColor = vec4(' + 
            ((useImage)
            ? 'reg[0]'
            : 'fract(reg[0])') +
            ', 1.0);\n' +
            '}\n';
	    if (variation == 0) {
	        console.log(dojo.byId('shader-vs').text);
	        console.log(shaderCode);
	    }
	    dojo.byId('shader-fs').text = shaderCode;
	    var canvas = (typeof targetCanvas === 'undefined')? dojo.byId('canvas' + variation) : targetCanvas;
	    var gl = create3DContext(canvas, { antialias: false });
	    var vertexShader = createShaderFromScriptElement(gl, 'shader-vs');
	    var fragmentShader = createShaderFromScriptElement(gl, 'shader-fs');
	    var program = createProgram(gl, [vertexShader, fragmentShader]);
	    gl.useProgram(program);

        function makeAttribFloat32Buffer(name, array, n) {
            var location = gl.getAttribLocation(program, name);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());  
            // STATIC_DRAW: The data store contents will be specified once by the application, and used many times as the source for GL drawing commands.
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW); 
            gl.enableVertexAttribArray(location); 
            gl.vertexAttribPointer(location, n, gl.FLOAT, false, 0, 0);  
        }
	    
	    if (useImage) {
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);  
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mBaseImage);
            makeAttribFloat32Buffer('aTexCoord', [
                    0.0, 0.0,
                    0.0, 1.0,
                    1.0, 0.0,
                    1.0, 1.0
                ], 2);
        }
        makeAttribFloat32Buffer('aColor', [
                0.0,  1.0,  0.0,  1.0, // green
                0.0,  0.0,  0.0,  1.0, // black
                1.0,  1.0,  0.0,  1.0, // yellow
                1.0,  0.0,  0.0,  1.0  // red
            ], 4);
        makeAttribFloat32Buffer('aPosition', [
                -1.0, -1.0,
                -1.0,  1.0,
                 1.0, -1.0,
                 1.0,  1.0
            ], 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	    window.postMessage({ message: 'painted', variation: variation }, '*');
    }
    return {
        Init: function() {
            Feature.CheckAll();
            function isDisabled(key) {
                var params = document.location.search.substring(1).split('&');
                for (var i = 0; i < params.length; ++i){
                     var kv = params[i].split('=');
                     if (kv[0] == key && kv[1].match(/(off|false|0|no)/))
                        return true;
                }
                return false;
            }
            mNaClEnabled = (function() {
                    // NaCl lässt sich durch den URL-Parameter "nacl=off" abschalten
                    if (isDisabled('nacl'))
                        return false;
                    // XXX: liefert fälschlicherweise true zurück, wenn Plug-in 
                    // vorhanden, aber nicht aktiv oder kein für die Plattform
                    // geeigneter Code vorhanden. Besser wäre eine Prüfung, ob
                    // ein Dummy-NaCl-Modul erfolgreich geladen wurde.
                    return Feature.NaCl;
                })();
            mWebGLEnabled = (function() {
                    // WebGL lässt sich durch den URL-Parameter "nacl=off" abschalten
                    if (isDisabled('webgl'))
                        return false;
                    return Feature.WebGL;
                })();
            mWebWorkerEnabled = (function() {
                    // Web Worker lassen sich durch den URL-Parameter "worker=off" abschalten
                    if (isDisabled('worker'))
                        return false;
                    return Feature.WebWorker;
                })();
            if (Feature.FileAPI) {
                var console = dojo.byId('console');
                console.addEventListener('dragover', handleDragOverConsole, false);
                console.addEventListener('dragleave', handleDragLeaveConsole, false);
                console.addEventListener('drop', handleFileSelectConsole, false);
            }
            mPictureOverlay = dojo.byId('pictureoverlay');
            loadHighlights();
            updatePictureSize();
            generateInitialTransform();
            Qbist.MakeVariations();
            generateModuleElements();
            updateScaleButtonTitles();
            resizeImportExportBox();
            window.addEventListener('resize', resizeImportExportBox);
            window.addEventListener('message', handleMessageFromModule);
            if (Feature.FileAPI && !mNaClEnabled) {
                dojo.style('overlaymethodchooser', 'display', 'inline');
            }
            if (!mNaClEnabled)
                Qbist.PostToAllModules();
            addParametersToHistory();
            if (mWebGLEnabled) {
                dojo.byId('mode').innerHTML = 'WebGL';
            }
            else if (mNaClEnabled) {
                dojo.byId('mode').innerHTML = 'NaCl';
                dojo.style('threadselector', 'display', 'inline');
            }
            else if (mWebWorkerEnabled) {
                dojo.byId('mode').innerHTML = 'Web&nbsp;Worker';
                dojo.style('threadselector', 'display', 'inline');
            }
            else {
                dojo.byId('mode').innerHTML = 'JavaScript';
            }
        },
        Restart: function() {
            History.Clear();
            if (Feature.FileAPI && !mNaClEnabled) {
                dojo.byId('overlaymethod').selectedIndex = 0;
                if (mBaseImage.src.indexOf(DUMMY_IMAGE) != -1) {
                    generateInitialTransform();
                    Qbist.MakeVariations();
                    Qbist.PostToAllModules();
                }
                else {
                    mBaseImage.onload = function() {
                            generateInitialTransform();
                            Qbist.MakeVariations();
                            Qbist.PostToAllModules();
                        };
                    mBaseImage.src = DUMMY_IMAGE;
                }
            }
            else {
                generateInitialTransform();
                Qbist.MakeVariations();
                Qbist.PostToAllModules();
            }
            addParametersToHistory();
        },
        Previous: function() {
            setParameters(History.Previous());
        },
        Next: function() {
            setParameters(History.Next());
        },
        MakeVariations: function() {
            var v, i, variance = parseInt(dojo.byId('variance').value) || 0;
            var nTransforms = mTransform[0].length;
	        for (v = 1; v < NUM_VARIATIONS; ++v) {
		        for (i = 0; i < nTransforms; ++i) {
			        mTransform[v][i] = mTransform[0][i];
			        mSource[v][i] = mSource[0][i];
			        mControl[v][i] = mControl[0][i];
			        mDest[v][i] = mDest[0][i];
		        }
	        }
	        for (v = 1; v < NUM_VARIATIONS; ++v) {
	            if (variance == 0) {
			        switch (rand(4))
			        {
			        case 0: mTransform[v][rand(nTransforms)] = rand(TOTAL_TRANSFORMS); break;
			        case 1: mSource[v][rand(nTransforms)] = rand(NUM_REGISTERS); break;
			        case 2: mControl[v][rand(nTransforms)] = rand(NUM_REGISTERS); break;
			        case 3: mDest[v][rand(nTransforms)] = rand(NUM_REGISTERS); break;
			        }
	            }
	            else {
	                for (i = 0; i < variance; ++i) {
			            mTransform[v][rand(nTransforms)] = rand(TOTAL_TRANSFORMS);
			            mSource[v][rand(nTransforms)] = rand(NUM_REGISTERS);
			            mControl[v][rand(nTransforms)] = rand(NUM_REGISTERS);
			            mDest[v][rand(nTransforms)] = rand(NUM_REGISTERS);
			        }
		        }
	        }
	        Qbist.Export();
        },
        SelectMainVariation: function(i) {
	        for (var j = 0; j < mTransform[0].length; ++j) {
		        mTransform[0][j] = mTransform[i][j];
		        mSource[0][j] = mSource[i][j];
		        mControl[0][j] = mControl[i][j];
		        mDest[0][j] = mDest[i][j];
	        }
        },
        PostToAllModules: function() {
            startTimer();
            for (var i = 0; i < NUM_VARIATIONS; ++i) {
                dojo.style(mScaleOverlay[i], 'background-image', 'url(loader-icon-16x16.png)');        
                postToModule(i, (!mWebGLEnabled)? mModule[i] : mCanvas[i]);
            }
        },
        Remove: function(name) {
            if (!Storage.isAvailable || name == CHOOSE)
                return;
            var localHighlights = Storage.get('highlights');
            if (!localHighlights[name]) {
                alert('Es lassen sich nur lokal gespeicherte Einträge löschen!');
                return;
            }
            if (confirm('Den Namen "' + name + '" wirklich löschen?')) {
                delete localHighlights[name];
                delete mHighlights[name];
                Storage.set('highlights', localHighlights);
                generateHighlightSelection();
            }
        },
        DownloadAll: function() {
            document.location.href = 'data:text/json;charset=utf-8,' + JSON.stringify(mHighlights);
        },
        Store: function(name, data) {
            if (!localStorage)
                return;
            var localHighlights = JSON.parse(localStorage.getItem('highlights') || '{}');
            var doSave = true;
            if (localHighlights[name] || mHighlights[name])
                doSave = confirm('Dieser Name ist schon vorhanden. Trotzdem verwenden? Wenn OK, werden die darunter gespeicherten Daten überschrieben.');
            if (doSave) {
                localHighlights[name] = JSON.parse(data);
                localStorage.setItem('highlights', JSON.stringify(localHighlights));
                mergeLocalStorageIntoHighlights();
                generateHighlightSelection();
            }
        },
        Export: function(variation) {
            variation = variation || 0;
            var data = {
                transform: mTransform[variation],
                source: mSource[variation],
                control: mControl[variation],
                dest: mDest[variation]
            };
            dojo.byId('console').value = JSON.stringify(data);
        },
        Benchmark: function() {
            var data = [
                {"transform":[6,1,5,8,1,5,0,4,4,1,4,5,3,1,6,4,3,6,8,7,7,2,0,1,3,5,7,5],"source":[5,3,2,5,5,3,3,0,0,3,2,2,3,0,3,4,1,1,4,4,1,5,2,1,0,0,3,2],"control":[1,4,0,4,2,5,2,3,3,3,4,0,0,0,0,4,4,2,4,2,1,5,1,3,2,4,2,2],"dest":[4,4,3,3,5,0,1,2,4,4,3,5,2,4,5,2,2,1,0,1,4,0,0,0,1,0,1,4]},
                {"transform":[6,1,5,1,1,5,0,4,4,5,4,5,3,1,6,4,3,6,8,7,7,2,0,1,3,5,7,5,8,4,2,1,4,5,1,4],"source":[5,3,2,5,5,3,3,0,0,3,2,2,3,0,3,4,3,1,4,4,1,5,2,1,0,0,3,2,2,4,2,5,2,0,3,5],"control":[1,4,0,4,2,5,2,4,3,3,4,0,3,0,0,4,4,2,4,2,1,5,1,3,2,4,2,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,3,5,4,1,2,4,4,3,5,2,4,5,2,2,1,0,1,4,0,0,0,2,0,1,4,3,1,4,2,3,4,4,1]},
                {"transform":[6,1,5,8,1,5,0,4,4,1,4,8,3,1,6,4,3,6,8,7,1,2,0,1,3,5,7,5,8,4,0,6,4,5,1,4],"source":[5,3,2,5,5,5,3,0,0,3,2,2,3,0,3,4,1,1,4,4,1,5,2,1,0,4,3,2,2,4,2,5,2,0,3,5],"control":[3,4,0,4,2,0,2,3,3,3,4,0,0,0,0,4,4,2,4,2,1,5,1,3,2,4,2,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,3,1,0,1,2,4,4,3,5,2,4,5,2,2,1,0,1,4,0,0,0,1,0,1,4,3,1,3,2,3,4,4,1]},
                {"transform":[6,1,5,8,3,7,0,4,4,1,4,5,3,1,6,4,3,6,8,7,7,2,0,1,3,5,7,5,8,4,2,1,4,5,1,4],"source":[5,3,2,5,5,3,3,5,0,3,1,2,3,0,3,4,1,1,4,4,1,5,2,1,0,0,3,2,2,4,2,5,2,0,3,5],"control":[1,4,0,4,2,5,2,3,3,3,1,0,0,0,0,4,4,2,4,2,1,5,1,3,2,0,2,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,3,5,0,1,2,4,0,3,5,2,4,5,2,2,1,0,1,4,0,0,0,1,0,1,4,3,1,4,2,3,4,4,1]},
                {"transform":[1,1,5,8,1,5,0,4,4,1,4,5,3,1,6,4,3,6,8,7,7,2,0,1,3,5,7,5,8,4,2,1,4,5,1,4],"source":[5,3,2,5,5,3,3,0,4,3,2,2,3,0,3,4,1,3,4,4,1,5,2,1,0,0,3,2,2,4,2,5,2,0,3,5],"control":[1,0,0,4,2,5,2,3,3,3,4,0,0,0,0,4,4,2,4,2,1,5,1,4,2,4,2,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,0,5,0,1,2,4,4,3,5,2,4,5,2,2,1,0,2,4,0,0,0,1,0,1,4,3,1,4,2,3,4,4,1]},
                {"transform":[6,1,5,8,1,5,0,5,4,1,4,5,3,1,6,4,3,6,8,8,7,2,0,1,3,5,7,5,8,4,2,1,4,5,1,4],"source":[5,0,2,5,5,3,3,0,0,0,2,2,3,0,3,4,1,1,4,4,1,5,2,1,0,0,3,2,2,4,2,5,2,0,3,2],"control":[1,4,0,4,2,5,2,3,3,3,4,0,0,0,0,4,4,2,4,2,1,5,1,3,2,4,5,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,3,5,0,1,2,4,4,3,5,2,4,5,2,2,1,0,1,4,0,0,5,1,0,1,4,3,1,4,2,3,4,4,1]},
                {"transform":[6,1,5,8,1,5,0,4,4,1,4,5,3,1,6,4,3,6,8,7,7,2,3,1,3,5,7,5,8,4,2,1,4,5,1,4],"source":[5,3,2,5,5,3,3,0,0,3,2,2,3,0,3,4,1,1,4,4,1,5,4,1,0,0,3,2,2,4,2,5,2,0,3,5],"control":[1,4,0,4,2,5,2,3,3,3,4,0,0,0,1,4,0,2,4,2,1,5,1,3,2,4,2,2,0,1,0,5,4,5,1,4],"dest":[4,4,3,3,5,0,0,2,4,5,3,5,2,4,5,2,2,1,0,1,4,0,0,0,1,0,1,4,3,1,4,2,4,4,4,1]},
                {"transform":[6,1,5,8,1,5,0,4,4,1,4,5,3,1,6,4,3,5,8,7,7,3,0,1,3,5,7,5,5,4,2,1,4,5,1,4],"source":[5,3,2,5,5,3,3,0,0,3,2,2,1,0,3,4,1,1,4,4,1,5,2,1,0,0,3,2,2,4,2,5,2,0,3,5],"control":[1,4,0,4,5,5,2,3,4,3,4,0,0,0,0,4,4,2,4,2,1,5,1,3,2,4,2,2,0,5,0,5,4,5,1,4],"dest":[4,4,3,3,5,0,1,2,4,4,3,5,2,4,5,2,2,1,0,1,4,0,0,4,1,0,1,4,3,1,4,2,3,4,4,1]}
            ];
            for (var i in data) {
                mTransform[i] = data[i].transform;
                mDest[i] = data[i].dest;
                mSource[i] = data[i].source;
                mControl[i] = data[i].control;
            }
            Qbist.PostToAllModules();
        },
        Import: function(what) {
            var d = (typeof what === 'string')? JSON.parse(what) : what;
            if (typeof d !== 'object') {
                alert('Ungültige Daten!');
                return;
            }
            mTransform[0] = d.transform;
            mSource[0] = d.source;
            mControl[0] = d.control;
            mDest[0] = d.dest;
            Qbist.MakeVariations();
            Qbist.PostToAllModules();
            markVariation(0);
            addParametersToHistory();
            scrollToTop();
        },
        SetImageWidth: function(width) {
            mPictureSize.w = width;
            updateScaleButtonTitles();
        },
        SetImageHeight: function(height) {
            mPictureSize.h = height;
            updateScaleButtonTitles();
        },
        ScrollTo: function(y) {
            (new dojo.Animation({
                    node: document.body,
                    duration: 1000,
                    rate: 20,
                    curve: [ document.body.scrollTop, y ],
                    easing: function(n) { n=2*n; return (n<1)? 0.5*n*n : -0.5*((n-1)*(n-3)-1); },
                    onAnimate: function(value) { document.body.scrollTop = value; }
                })).play();
        },
        ResetHighlightSelection: function() {
            dojo.byId('highlightselector').selectedIndex = 0;
        },
        DrawTheBigThingOnACanvas: function(variation) {
            var i, percent, Y0, worker, workerPercent, imageWindow, tilesReady, tile, newWorker, data, result;
            var threadCount = mWebWorkerEnabled? parseInt(dojo.byId('threadcount').value) : 1;
            var w = mPictureSize.w;
            var h = mPictureSize.h / threadCount;
            var winW = (window.screen.availWidth  > w)? mPictureSize.w : window.screen.availWidth;
            var winH = (window.screen.availHeight > h)? mPictureSize.h : window.screen.availHeight;
            var bigcanvas = dojo.create('canvas');
            bigcanvas.id = 'bigcanvas';
            bigcanvas.width = mPictureSize.w;
            bigcanvas.height = mPictureSize.h;
            bigcanvas.setAttribute('style', 'width: ' + mPictureSize.w + 'px; height: ' + mPictureSize.h + 'px');
            dojo.place(bigcanvas, 'hiddencanvascontainer', 'only');
            startTimer();
            if (mWebGLEnabled) {
                generateShaderCode(variation, bigcanvas);
                imageWindow = window.open('explorer.html', 'QbistExplorer', 'width=' + winW + ',height=' + winH + ',status=no,toolbar=no,resizable=yes,menubar=no,location=no,dependent=yes');
                imageWindow.focus();
                stopTimer();
            }
            else if (mWebWorkerEnabled) {
                imageWindow = window.open('imagewindow.html', 'QbistImage', 'width=' + winW + ',height=' + winH + ',status=no,toolbar=no,resizable=yes,menubar=no,location=no,dependent=yes');
                worker = [];
                workerPercent = [];
                tilesReady = 0;
                tile = threadCount;
                while (tile--) {
                    Y0 = tile * h;
                    newWorker = new Worker('worker.js');
                    worker.push(newWorker);
                    workerPercent.push(0);
                    newWorker.addEventListener('message', function(e) {
                            var d = e.data;
                            switch (d.message)
                            {
                            case 'progress':
                                if (imageWindow.document == null)
                                    return;
                                workerPercent[d.tile] = d.percent;
                                for (percent = 0, i = 0; i < threadCount; ++i)
                                    percent += workerPercent[i];
                                imageWindow.postMessage(percent/threadCount, window.location.href);
                                break;
                            case 'painted':
                                if (imageWindow.document == null)
                                    return;
                                bigcanvas.getContext('2d').putImageData(d.imageData, 0, d.Y0);
                                worker[d.tile].postMessage({ command: 'close' });
                                if (++tilesReady == threadCount) {
                                    stopTimer();
                                    imageWindow.location.href = bigcanvas.toDataURL('image/png');
                                    imageWindow.focus();
                                    // Zur Verhinderung von Speicherlecks Worker nach kurzer
                                    // Zeit löschen. Hoffentlich haben sie sich bis dahin
                                    // durch self.close() schon selbst beendet ...
                                    setTimeout(function() {
                                            for (i = 0; i < worker.length; ++i)
                                                delete worker[i];
                                            delete worker;
                                        }, 2000);
                                }
                                break;
                            case 'debug':
                                console.log('[DEBUG] '.concat(d.info));
                                break;
                            }
                        }, false);
                    data = {
                        command: 'paint',
                        variation: variation,
                        tile: tile,
                        Y0: Y0,
                        numTiles: threadCount,
                        NUM_REGISTERS: NUM_REGISTERS,
                        overlayMethod: dojo.byId('overlaymethod').value
                    };
                    if (Feature.FileAPI) {
                        bigcanvas.getContext('2d').drawImage(mBaseImage, 0, 0, w, mPictureSize.h);
                        data.imageData = bigcanvas.getContext('2d').getImageData(0, Y0, w, h);
                    }
                    else {
                        data.imageData = bigcanvas.getContext('2d').createImageData(w, h);
                    }
                    result = optimize(mTransform[variation], mDest[variation], mSource[variation], mControl[variation], NUM_REGISTERS);
                    data.transform = result.transform;
                    data.dest = result.dest;
                    data.source = result.source;
                    data.control = result.control;
                    if (isChromeBrowserEqualOrGreaterThan(17))
                        newWorker.webkitPostMessage(data);
                    else
                        newWorker.postMessage(data);
                }
            }
            else { // JavaScript-only-Modus
                dojo.byId('bigloader').setAttribute('style', 'display: block; left: ' + Math.round(window.scrollX+(window.innerWidth-66)/2) + 'px; top: ' + Math.round(window.scrollY+(window.innerHeight-166)/2) + 'px;');
                dojo.style('body', 'opacity', 0.1);
                Async.call(function(){
                        var data = {
                            command: 'paint',
                            variation: variation,
                            NUM_REGISTERS: NUM_REGISTERS,
                            overlayMethod: dojo.byId('overlaymethod').value
                        };
                        var result = optimize(mTransform[variation], mDest[variation], mSource[variation], mControl[variation], NUM_REGISTERS);
                        data.transform = result.transform;
                        data.dest = result.dest;
                        data.source = result.source;
                        data.control = result.control;
                        if (Feature.FileAPI) {
                            bigcanvas.getContext('2d').drawImage(mBaseImage, 0, 0, w, h);
                            data.imageData = bigcanvas.getContext('2d').getImageData(0, 0, w, h);
                        }
                        else {
                            data.imageData = bigcanvas.getContext('2d').createImageData(w, h)
                        }
                        var imgd = DrawOnCanvas(data, true);
                        stopTimer();
                        bigcanvas.getContext('2d').putImageData(data.imageData, 0, 0);
                        bigcanvas.title = 'Variation #' + variation + ' (' + w + 'x' + h + ')';
                        var imageWindow = window.open('imagewindow2.html', 'QbistImage', 'width=' + winW + ',height=' + winH + ',status=no,toolbar=no,resizable=yes,menubar=no,location=no,dependent=yes');
                        dojo.style('bigloader', 'display', 'none');
                        dojo.style('body', 'opacity', 1);
                    });
            }
        }
    };
})();

dojo.ready(function() {
    History.Init();
    Qbist.Init();
    
//    // Facebook Like button
//    (function(d, s, id) {
//      var js, fjs = d.getElementsByTagName(s)[0];
//      if (d.getElementById(id)) return;
//      js = d.createElement(s); js.id = id;
//      js.src = "//connect.facebook.net/de_DE/all.js#xfbml=1";
//      fjs.parentNode.insertBefore(js, fjs);
//    }(document, 'script', 'facebook-jssdk'));
//    // Google +1 button
//    window.___gcfg = {lang: 'de'};
//    (function() {
//        var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true;
//        po.src = 'https://apis.google.com/js/plusone.js';
//        var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
//    })();
});
