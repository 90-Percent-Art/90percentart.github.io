 (function(){
    var container = document.getElementById('make-sketch');
    var selector = document.getElementById('sketchSelector');
    var currentP5 = null;
    var registeredApi = null;
    var lastSketchName = null;

    function make(name) {
        // destroy previous instance if present
        try {
            if (currentP5 && typeof currentP5.remove === 'function') currentP5.remove();
        } catch(e) { /* ignore */ }
        currentP5 = null;
        registeredApi = null;

        var sketchFn = (window.sketches && window.sketches[name]) ? window.sketches[name] : window.sketches['default'];
        if (!sketchFn) {
            console.error('Sketch not found:', name);
            return;
        }

        // create instance
        currentP5 = new p5(function(p){
            // adapter provides a register function; sketches can call p.registerSketchAPI(register)
            p.registerSketchAPI = function(register) {
                if (typeof register === 'function') {
                    register(function(api){ registeredApi = api || registeredApi; });
                }
            };
            // call the chosen sketch function
            try {
                sketchFn(p);
            } catch (err) {
                console.error('Error initializing sketch:', err);
            }
        }, container);

        // attempt to capture the sketch API if the sketch exposes it via p.registerSketchAPI
        setTimeout(function() {
            try {
                if (currentP5 && typeof currentP5.registerSketchAPI === 'function') {
                    currentP5.registerSketchAPI(function(api){ registeredApi = api || registeredApi; });
                }
            } catch (e) { /* ignore */ }
        }, 60);

        lastSketchName = name;

        // wire global sketchAPI used by the UI controls to sketch methods
        window.sketchAPI = {
            regenerate: function() {
                if (registeredApi && typeof registeredApi.regenerate === 'function') {
                    return registeredApi.regenerate();
                }
                if (currentP5 && typeof currentP5.regenerate === 'function') {
                    return currentP5.regenerate();
                }
            },
            togglePause: function() {
                if (registeredApi && typeof registeredApi.togglePause === 'function') {
                    return registeredApi.togglePause();
                }
                if (currentP5 && typeof currentP5.togglePause === 'function') {
                    return currentP5.togglePause();
                }
                return false;
            }
            ,
            savePNG: function() {
                try {
                    if (!currentP5 || !currentP5.canvas) {
                        alert('No canvas to save.');
                        return;
                    }
                    var data = currentP5.canvas.toDataURL('image/png');
                    var a = document.createElement('a');
                    a.href = data;
                    var ts = new Date().toISOString().replace(/[:.]/g,'-');
                    a.download = '90percentart-'+ (lastSketchName||'sketch') + '-' + ts + '.png';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } catch (e) {
                    console.error('savePNG failed', e);
                    alert('PNG export failed: ' + e.message);
                }
            },
            saveSVG: function() {
                // prefer sketch-provided SVG export if available
                if (registeredApi && typeof registeredApi.saveSVG === 'function') {
                    try { return registeredApi.saveSVG(); } catch(e) { console.error('registeredApi.saveSVG error', e); }
                }

                // experimental fallback: try to re-render the sketch into an SVG renderer and download
                if (typeof p5 === 'undefined' || (!p5.RendererSVG && !p5.SVG)) {
                    alert('SVG export requires p5.svg addon.');
                    return;
                }
                var sketchFn = (window.sketches && window.sketches[lastSketchName]) ? window.sketches[lastSketchName] : window.sketches['default'];
                if (!sketchFn) {
                    alert('No sketch available for SVG export.');
                    return;
                }

                // create hidden container for SVG rendering
                var hidden = document.createElement('div');
                hidden.style.position = 'fixed';
                hidden.style.left = '-99999px';
                hidden.style.top = '0';
                document.body.appendChild(hidden);

                var tempP5 = new p5(function(p) {
                    // force createCanvas to use SVG renderer if available
                    var origCreate = p.createCanvas;
                    p.createCanvas = function(w,h) { try { return origCreate.call(p, w, h, p.SVG); } catch(e) { return origCreate.call(p, w, h); } };
                    // ensure single-frame render
                    p.setup = function() {};
                    p.draw = function() {};
                    try {
                        // initialize sketch (defines setup/draw on this p instance)
                        sketchFn(p);
                    } catch (err) {
                        console.error('Error initializing sketch for SVG export:', err);
                    }
                }, hidden);

                // wait a short moment for p5 to run setup/draw, then grab svg
                setTimeout(function() {
                    try {
                        var svg = hidden.querySelector('svg');
                        if (!svg) {
                            alert('SVG export failed: no <svg> element rendered.');
                        } else {
                            var serializer = new XMLSerializer();
                            var str = serializer.serializeToString(svg);
                            var blob = new Blob([str], {type: 'image/svg+xml;charset=utf-8'});
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            var ts = new Date().toISOString().replace(/[:.]/g,'-');
                            a.download = '90percentart-'+ (lastSketchName||'sketch') + '-' + ts + '.svg';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                        }
                    } catch (e) {
                        console.error('SVG export error', e);
                        alert('SVG export failed: ' + e.message);
                    } finally {
                        try { tempP5.remove(); } catch(e) {}
                        hidden.remove();
                    }
                }, 250);
            }
        };
        // also expose a randomize helper
        window.sketchAPI.randomize = function() {
            if (registeredApi && typeof registeredApi.randomize === 'function') {
                try { registeredApi.randomize(); return; } catch(e) { console.error(e); }
            }
            // otherwise randomize any params if present
            if (registeredApi && Array.isArray(registeredApi.params)) {
                registeredApi.params.forEach(function(pdef){
                    if (pdef.type === 'range' || pdef.type === undefined) {
                        var min = (typeof pdef.min !== 'undefined') ? pdef.min : 0;
                        var max = (typeof pdef.max !== 'undefined') ? pdef.max : 100;
                        var val = Math.floor(Math.random() * (max - min + 1)) + min;
                        pdef.value = val;
                        var el = document.getElementById(pdef.id);
                        if (el) el.value = val; 
                    }
                });
                // trigger regenerate
                if (typeof window.sketchAPI.regenerate === 'function') window.sketchAPI.regenerate();
            }
        };

        // update parameter UI if sketch provides params
        setTimeout(function(){
            try {
                var paramsContainer = document.getElementById('dynamicParams');
                var staticControls = document.getElementById('staticControls');
                // clear existing dynamic
                if (paramsContainer) paramsContainer.innerHTML = '';

                var params = (registeredApi && registeredApi.params) ? registeredApi.params : null;
                if (params && params.length && paramsContainer) {
                    // hide static controls
                    if (staticControls) staticControls.style.display = 'none';
                    params.forEach(function(pdef){
                        var row = document.createElement('div');
                        row.className = 'mb-3';

                        var label = document.createElement('label');
                        label.className = 'control-label';
                        var spanLabel = document.createElement('span');
                        spanLabel.textContent = pdef.label || pdef.id;
                        var spanValue = document.createElement('span');
                        spanValue.className = 'value';
                        spanValue.id = pdef.id + 'Value';
                        spanValue.textContent = (typeof pdef.value !== 'undefined') ? pdef.value : '';
                        label.appendChild(spanLabel);
                        label.appendChild(spanValue);

                        var input;
                        if ((pdef.type === 'range') || pdef.type === undefined) {
                            input = document.createElement('input');
                            input.type = 'range';
                            input.min = pdef.min || 0;
                            input.max = pdef.max || 100;
                            input.step = (typeof pdef.step !== 'undefined') ? pdef.step : 1;
                            input.value = (typeof pdef.value !== 'undefined') ? pdef.value : input.min;
                        } else if (pdef.type === 'number') {
                            input = document.createElement('input');
                            input.type = 'number';
                            input.min = pdef.min || 0;
                            input.max = pdef.max || 100000;
                            input.step = (typeof pdef.step !== 'undefined') ? pdef.step : 1;
                            input.value = (typeof pdef.value !== 'undefined') ? pdef.value : input.min;
                        } else if (pdef.type === 'select') {
                            input = document.createElement('select');
                            (pdef.options||[]).forEach(function(opt){
                                var o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label||opt.value; if (opt.value==pdef.value) o.selected=true; input.appendChild(o);
                            });
                        } else {
                            input = document.createElement('input'); input.type = 'text'; input.value = pdef.value || '';
                        }

                        input.id = pdef.id;
                        input.className = 'form-control form-control-sm';
                        // on change handler
                        input.addEventListener('input', function(ev){
                            var val = (input.type==='range' || input.type==='number') ? Number(input.value) : input.value;
                            if (spanValue) spanValue.textContent = input.value;
                            // update global controls map
                            window.controls = window.controls || {};
                            window.controls[pdef.id] = val;
                            // notify sketch API
                            if (registeredApi && typeof registeredApi.setParam === 'function') {
                                try { registeredApi.setParam(pdef.id, val); } catch(e){}
                            }
                            if (typeof window.sketchAPI.regenerate === 'function') window.sketchAPI.regenerate();
                        });

                        row.appendChild(label);
                        row.appendChild(input);
                        paramsContainer.appendChild(row);
                    });
                } else {
                    if (staticControls) staticControls.style.display = '';
                }
            } catch(e) { console.error('build param UI error', e); }
        }, 80);
    }

    // create initial sketch based on selector value
    if (selector) {
        selector.addEventListener('change', function(){
            make(selector.value);
        });
        make(selector.value || 'default');
    } else {
        // no selector present - fallback to default
        make('default');
    }
})();