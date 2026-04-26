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
                if (typeof p5 === 'undefined') {
                    alert('SVG export requires p5.');
                    return;
                }
                var svgRenderers = [];
                if (currentP5 && currentP5.SVG) svgRenderers.push(currentP5.SVG);
                if (typeof p5 !== 'undefined' && p5.SVG) svgRenderers.push(p5.SVG);
                if (typeof window !== 'undefined' && window.SVG) svgRenderers.push(window.SVG);
                if (typeof p5 !== 'undefined' && p5.RendererSVG) svgRenderers.push(p5.RendererSVG);

                var svgRenderer = svgRenderers.length ? svgRenderers[0] : null;
                var sketchFn = (window.sketches && window.sketches[lastSketchName]) ? window.sketches[lastSketchName] : window.sketches['default'];
                if (!sketchFn) {
                    alert('No sketch available for SVG export.');
                    return;
                }
                var ts = new Date().toISOString().replace(/[:.]/g,'-');
                var filename = '90percentart-'+ (lastSketchName||'sketch') + '-' + ts + '.svg';
                var fileHandlePromise = null;

                if (window.showSaveFilePicker) {
                    try {
                        fileHandlePromise = window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: 'SVG file',
                                accept: { 'image/svg+xml': ['.svg'] }
                            }]
                        });
                    } catch (pickerErr) {
                        if (pickerErr && pickerErr.name === 'AbortError') return;
                        console.warn('showSaveFilePicker unavailable for SVG export', pickerErr);
                        fileHandlePromise = null;
                    }
                }

                // create hidden container for SVG rendering
                var hidden = document.createElement('div');
                hidden.style.position = 'fixed';
                hidden.style.left = '-99999px';
                hidden.style.top = '0';
                document.body.appendChild(hidden);
                var originalGetElementById = document.getElementById.bind(document);
                document.getElementById = function(id) {
                    if (id === 'make-sketch') return hidden;
                    return originalGetElementById(id);
                };

                var tempP5 = new p5(function(p) {
                    // force createCanvas to use SVG renderer if available
                    var origCreate = p.createCanvas;
                    p.createCanvas = function(w,h) {
                        if (svgRenderer) {
                            try { return origCreate.call(p, w, h, svgRenderer); } catch(e) {}
                        }
                        for (var i = 0; i < svgRenderers.length; i++) {
                            try { return origCreate.call(p, w, h, svgRenderers[i]); } catch(e) {}
                        }
                        return origCreate.call(p, w, h);
                    };
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

                setTimeout(function() {
                    try {
                        if (tempP5 && typeof tempP5.redraw === 'function') tempP5.redraw();
                    } catch (redrawErr) {
                        console.warn('Temporary SVG redraw failed', redrawErr);
                    }
                }, 50);

                // wait a short moment for p5 to run setup/draw, then grab svg
                setTimeout(async function() {
                    try {
                        async function exportSvgWithRetry(attempt) {
                            var svg = null;
                            if (tempP5 && tempP5._renderer && tempP5._renderer.svg) {
                                svg = tempP5._renderer.svg;
                            }
                            if (!svg) svg = hidden.querySelector('svg');
                            if (!svg) {
                                alert('SVG export failed: no <svg> element rendered. The p5.svg renderer may not be loading on this page.');
                                return;
                            }

                            var serializer = new XMLSerializer();
                            var str = serializer.serializeToString(svg);
                            var hasDrawnContent = !!svg.querySelector('path, line, rect, circle, ellipse, polyline, polygon, g');
                            if ((!str || !str.trim() || str.trim() === '<svg xmlns="http://www.w3.org/2000/svg"></svg>' || !hasDrawnContent) && attempt < 2) {
                                if (tempP5 && typeof tempP5.redraw === 'function') tempP5.redraw();
                                await new Promise(function(resolve) { setTimeout(resolve, 250); });
                                return exportSvgWithRetry(attempt + 1);
                            }
                            if (!str || !str.trim() || str.trim() === '<svg xmlns="http://www.w3.org/2000/svg"></svg>' || !hasDrawnContent) {
                                alert('SVG export failed: rendered SVG was empty.');
                                return;
                            }

                            if (fileHandlePromise) {
                                try {
                                    var fileHandle = await fileHandlePromise;
                                    var writable = await fileHandle.createWritable();
                                    await writable.write(str);
                                    await writable.close();
                                    return;
                                } catch (fileErr) {
                                    if (fileErr && fileErr.name === 'AbortError') return;
                                    console.warn('Native file save failed, falling back to download link', fileErr);
                                }
                            }

                            var blob = new Blob([str], {type: 'image/svg+xml;charset=utf-8'});
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.rel = 'noopener';
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            try {
                                a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                            } catch (clickErr) {
                                a.click();
                            }
                            setTimeout(function() {
                                a.remove();
                                URL.revokeObjectURL(url);
                            }, 1000);
                        }

                        await exportSvgWithRetry(0);
                    } catch (e) {
                        console.error('SVG export error', e);
                        alert('SVG export failed: ' + e.message);
                    } finally {
                        document.getElementById = originalGetElementById;
                        try { tempP5.remove(); } catch(e) {}
                        hidden.remove();
                    }
                }, 400);
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
                var groupMeta = {
                    general: { title: 'General', open: true },
                    paper: { title: 'Paper', open: false },
                    advanced: { title: 'Advanced', open: false }
                };
                // clear existing dynamic
                if (paramsContainer) paramsContainer.innerHTML = '';

                function getParamGroup(pdef) {
                    var id = pdef.id || '';
                    if (id === 'paperSize' || id === 'margin') return 'paper';
                    if (id === 'density' || id === 'penWidthMm' || id === 'hatchWeight' || id === 'alpha') return 'advanced';
                    return 'general';
                }

                function ensureGroup(name) {
                    var existing = document.getElementById('param-group-' + name);
                    if (existing) return existing.querySelector('.param-group-body');

                    var details = document.createElement('details');
                    details.className = 'param-group';
                    details.id = 'param-group-' + name;
                    if (groupMeta[name] && groupMeta[name].open) details.open = true;

                    var summary = document.createElement('summary');
                    summary.textContent = (groupMeta[name] && groupMeta[name].title) ? groupMeta[name].title : name;

                    var body = document.createElement('div');
                    body.className = 'param-group-body';

                    details.appendChild(summary);
                    details.appendChild(body);
                    paramsContainer.appendChild(details);
                    return body;
                }

                function getParamValue(id) {
                    var input = document.getElementById(id);
                    if (!input) return undefined;
                    return input.value;
                }

                function normalizeValues(values) {
                    return Array.isArray(values) ? values.map(String) : [String(values)];
                }

                function applyConditionalUI(params) {
                    (params || []).forEach(function(pdef) {
                        var row = document.querySelector('[data-param-id="' + pdef.id + '"]');
                        if (!row) return;

                        if (pdef.visibleWhen && pdef.visibleWhen.param) {
                            var currentValue = getParamValue(pdef.visibleWhen.param);
                            var allowedValues = normalizeValues(pdef.visibleWhen.values || []);
                            row.style.display = allowedValues.indexOf(String(currentValue)) !== -1 ? '' : 'none';
                        } else {
                            row.style.display = '';
                        }

                        var labelSpan = row.querySelector('.param-label-text');
                        if (labelSpan) {
                            var labelText = pdef.label || pdef.id;
                            if (pdef.labelByValue && pdef.labelByValue.param) {
                                var labelValue = getParamValue(pdef.labelByValue.param);
                                var mapped = pdef.labelByValue.values || {};
                                labelText = Object.prototype.hasOwnProperty.call(mapped, labelValue) ? mapped[labelValue] : (mapped.default || labelText);
                            }
                            labelSpan.textContent = labelText;
                        }
                    });
                }

                var params = (registeredApi && registeredApi.params) ? registeredApi.params : null;
                if (params && params.length && paramsContainer) {
                    // hide static controls
                    if (staticControls) staticControls.style.display = 'none';
                    params.forEach(function(pdef){
                        var row = document.createElement('div');
                        row.className = 'mb-3';
                        row.setAttribute('data-param-id', pdef.id);

                        var label = document.createElement('label');
                        label.className = 'control-label';
                        var spanLabel = document.createElement('span');
                        spanLabel.className = 'param-label-text';
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
                        } else if (pdef.type === 'color') {
                            input = document.createElement('input');
                            input.type = 'color';
                            input.value = pdef.value || '#000000';
                            if (spanValue) spanValue.style.display = 'none'; // swatch is its own indicator
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
                            applyConditionalUI(params);
                            if (typeof window.sketchAPI.regenerate === 'function') window.sketchAPI.regenerate();
                        });

                        row.appendChild(label);
                        row.appendChild(input);
                        ensureGroup(getParamGroup(pdef)).appendChild(row);
                    });
                    applyConditionalUI(params);
                } else {
                    if (staticControls) staticControls.style.display = '';
                }

                // show/hide pause button based on sketch capability
                var pauseBtn = document.getElementById('pause');
                if (pauseBtn) {
                    var supportsPause = !(registeredApi && registeredApi.hasPause === false);
                    pauseBtn.style.display = supportsPause ? '' : 'none';
                    pauseBtn.textContent = 'Pause'; // reset label on sketch switch
                }
            } catch(e) { console.error('build param UI error', e); }
        }, 80);
    }

    window.makeSketchApp = {
        make: make,
        remakeCurrent: function() {
            make((selector && selector.value) ? selector.value : (lastSketchName || 'default'));
        },
        getCurrentSketchName: function() {
            return (selector && selector.value) ? selector.value : lastSketchName;
        }
    };

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
