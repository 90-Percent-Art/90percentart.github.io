window.sketches = window.sketches || {};
window.sketches['cmyk'] = function(p) {

    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize:  '9x12',
        margin:     1,
        shape:      'boxes',
        viewMode:   'normal',
        fieldSeed:  1,
        circleSize: 50,
        paddingMm:  2,
        boxRotationDeg: 0,
        boxRotationMode: 'clean',
        composition: 50,
        penWidthMm: 0.4,
        noiseScale: 0.10,
        gradAngle:  0,
        density:    2,
        startColor: '#ff6600',
        endColor:   '#0066cc',
        palette: ['#00ffff', '#ff00ff', '#ffff00', '#000000'],
        viewMode: 'multiply'
    };

    // Normalize hex color to [0-1] per-channel RGB array
    function hexToRgbN(hex) {
        return [
            parseInt(hex.slice(1,3),16) / 255,
            parseInt(hex.slice(3,5),16) / 255,
            parseInt(hex.slice(5,7),16) / 255
        ];
    }

    // Lerp two hex colors in RGB space
    function lerpHex(a, b, t) {
        var ac = hexToRgbN(a), bc = hexToRgbN(b);
        return '#' + [0,1,2].map(function(i){
            var v = Math.round((ac[i] + (bc[i]-ac[i]) * t) * 255).toString(16);
            return v.length === 1 ? '0'+v : v;
        }).join('');
    }

    // Decompose a target hex color into weights for each palette color.
    // Each weight = 1 / (rgb_distance + epsilon). epsilon=0.30 (in normalized [0-1] space)
    // gives good overlap: the closest ink dominates (~5x) but others still contribute.
    // For CMYK palette this approximates the original CMYK decomposition;
    // for any other palette the same distance math distributes the gradient similarly.
    function colorDecompose(targetHex) {
        var pal = PARAMS.palette;
        var target = hexToRgbN(targetHex);
        var weights = [], sum = 0, eps = 0.30;
        for (var i = 0; i < pal.length; i++) {
            var c = hexToRgbN(pal[i]);
            var d = Math.sqrt(
                (target[0]-c[0])*(target[0]-c[0]) +
                (target[1]-c[1])*(target[1]-c[1]) +
                (target[2]-c[2])*(target[2]-c[2])
            );
            var w = 1 / (d + eps);
            weights.push(w);
            sum += w;
        }
        if (sum > 0) for (var j = 0; j < weights.length; j++) weights[j] /= sum;
        return weights;
    }

    // At gradient position t (0–1), lerp between startColor and endColor then
    // decompose into palette ink weights. All palette colors overlap everywhere;
    // the gradient shifts which ink dominates.
    function paletteWeightsAt(t) {
        return colorDecompose(lerpHex(PARAMS.startColor, PARAMS.endColor, t));
    }

    function pickFromWeights(weights, rng) {
        var pal = PARAMS.palette;
        var r = rng ? rng() : Math.random();
        var cumul = 0;
        for (var i = 0; i < pal.length - 1; i++) {
            cumul += weights[i];
            if (r < cumul) return pal[i];
        }
        return pal[pal.length - 1];
    }

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'shape', label: 'Shape', type: 'select', value: 'boxes',
              options: [
                { value: 'boxes', label: 'Boxes' },
                { value: 'circles', label: 'Circles' }
              ]},
            { id: 'viewMode', label: 'View mode', type: 'select', value: 'multiply',
              options: [
                { value: 'normal', label: 'Normal' },
                { value: 'multiply', label: 'Multiply' }
              ]},
            { id: 'circleSize', label: 'Shape size (px)', type: 'range', min: 15, max: 150, step: 5,  value: 50  },
            { id: 'paddingMm', label: 'Padding (mm)', type: 'range', min: 0, max: 10, step: 0.1, value: 2,
              _toInternal: function(v){ return v; } },
            { id: 'boxRotationDeg', label: 'Box rotation°', type: 'range', min: 0, max: 180, step: 1, value: 0 },
            { id: 'boxRotationMode', label: 'Box rotation mode', type: 'select', value: 'clean',
              options: [
                { value: 'clean', label: 'Clean grid' },
                { value: 'field', label: 'Follow field' }
              ]},
            { id: 'composition', label: 'Composition', type: 'range', min: 0, max: 100, step: 1, value: 50 },
            { id: 'penWidthMm', label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: 0.4 },
            { id: 'noiseScale', label: 'Perlin scale',     type: 'range', min: 1,  max: 50,  step: 1,  value: 10  },
            { id: 'gradAngle',  label: 'Gradient angle°', type: 'range', min: 0,   max: 355, step: 5,   value: 0, group: 'color' },
            { id: 'density',    label: 'Density (ln/mm)', type: 'range', min: 10,  max: 30,  step: 1,   value: 20,
              _toInternal: function(v){ return v / 10; } },
            { id: 'palette', label: 'Inks', type: 'colorPalette', maxSelect: 6,
              value: PARAMS.palette.slice(),
              options: [
                { value: '#00ffff', label: 'Cyan' },
                { value: '#ff00ff', label: 'Magenta' },
                { value: '#ffff00', label: 'Yellow' },
                { value: '#000000', label: 'Black' },
                { value: '#e63946', label: 'Red' },
                { value: '#2196f3', label: 'Blue' },
                { value: '#ff9800', label: 'Orange' },
                { value: '#4caf50', label: 'Green' },
                { value: '#9c27b0', label: 'Purple' },
                { value: 'custom',  label: 'Custom' }
              ]},
            { id: 'startColor', label: 'Gradient start', type: 'color', value: '#ff6600' },
            { id: 'endColor',   label: 'Gradient end',   type: 'color', value: '#0066cc' }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        reseed: function() {
            PARAMS.fieldSeed = Math.floor(Math.random() * 1e6);
            p.redraw();
        },
        getRecipe: function() {
            return { state: { fieldSeed: PARAMS.fieldSeed } };
        },
        applyRecipeState: function(state) {
            if (state && Number.isFinite(Number(state.fieldSeed))) {
                PARAMS.fieldSeed = Number(state.fieldSeed);
                p.redraw();
            }
        },
        saveSVG: function() {
            var dims = paper.getPaperPixels(PARAMS.paperSize);
            var marginPx  = paper.getMarginPixels(PARAMS.margin);
            var paddingPx = paper.mmToPixels(PARAMS.paddingMm);
            var cellSize  = PARAMS.circleSize;
            var availW    = dims.width  - 2 * marginPx;
            var availH    = dims.height - 2 * marginPx;
            var grid      = resolveGrid(availW, availH, cellSize + paddingPx, PARAMS.composition);
            var cols      = grid.cols;
            var rows      = grid.rows;
            var contentW  = cols * cellSize + Math.max(0, cols - 1) * paddingPx;
            var contentH  = rows * cellSize + Math.max(0, rows - 1) * paddingPx;
            var offsetX   = marginPx + (availW - contentW) / 2;
            var offsetY   = marginPx + (availH - contentH) / 2;
            var strokeW   = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
            var gradRad   = p.radians(PARAMS.gradAngle);
            var gdx       = Math.cos(gradRad);
            var gdy       = Math.sin(gradRad);
            var pMin = Infinity;
            var pMax = -Infinity;
            var svgParts = [];
            var ts = new Date().toISOString().replace(/[:.]/g,'-');
            var filename = '90percentart-cmyk-' + ts + '.svg';
            p.noiseSeed(PARAMS.fieldSeed);

            for (var ix = 0; ix < cols; ix++) {
                for (var jy = 0; jy < rows; jy++) {
                    var proj = (offsetX + (ix + 0.5) * cellSize) * gdx +
                               (offsetY + (jy + 0.5) * cellSize) * gdy;
                    if (proj < pMin) pMin = proj;
                    if (proj > pMax) pMax = proj;
                }
            }

            svgParts.push('<?xml version="1.0" encoding="UTF-8"?>');
            svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + dims.width + '" height="' + dims.height + '" viewBox="0 0 ' + dims.width + ' ' + dims.height + '">');
            if (PARAMS.viewMode === 'multiply') svgParts.push('<g style="mix-blend-mode:multiply">');
            svgParts.push('<rect x="1" y="1" width="' + (dims.width - 2) + '" height="' + (dims.height - 2) + '" fill="none" stroke="#b4b4b4" stroke-width="2"/>');

            for (var i = 0; i < cols; i++) {
                for (var j = 0; j < rows; j++) {
                    var cx = offsetX + i * (cellSize + paddingPx) + cellSize / 2;
                    var cy = offsetY + j * (cellSize + paddingPx) + cellSize / 2;
                    var t  = (pMax > pMin) ? ((cx * gdx + cy * gdy) - pMin) / (pMax - pMin) : 0;
                    var weights = paletteWeightsAt(t);
                    var angle = p.noise(i * PARAMS.noiseScale, j * PARAMS.noiseScale) * p.TWO_PI;
                    var rng   = makeRng(cellSeed(i, j));

                    if (PARAMS.shape === 'boxes') {
                        exportLineBox(svgParts, cx, cy, cellSize * 0.92, cellSize * 0.92, weights, angle,
                            p.radians(PARAMS.boxRotationDeg) + (PARAMS.boxRotationMode === 'field' ? angle : 0),
                            strokeW, rng);
                    } else {
                        exportLineCircle(svgParts, cx, cy, cellSize * 0.92, weights, angle, strokeW, rng);
                    }
                }
            }

            if (PARAMS.viewMode === 'multiply') svgParts.push('</g>');
            svgParts.push('</svg>');
            downloadSvgString(svgParts.join('\n'), filename);
        },
        setParam: function(name, val) {
            var pdef = api.params.find(function(x){ return x.id === name; });
            if (pdef) pdef.value = val;
            if (name === 'paperSize')  { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin')     PARAMS.margin     = Number(val);
            if (name === 'shape')      PARAMS.shape = val;
            if (name === 'viewMode')   PARAMS.viewMode = val;
            if (name === 'circleSize') PARAMS.circleSize = Number(val);
            if (name === 'paddingMm')  PARAMS.paddingMm = Number(val);
            if (name === 'boxRotationDeg') PARAMS.boxRotationDeg = Number(val);
            if (name === 'boxRotationMode') PARAMS.boxRotationMode = val;
            if (name === 'composition') PARAMS.composition = Number(val);
            if (name === 'penWidthMm') PARAMS.penWidthMm = Number(val);
            if (name === 'noiseScale') PARAMS.noiseScale = Number(val) / 100;
            if (name === 'gradAngle')  PARAMS.gradAngle  = Number(val);
            if (name === 'density')    PARAMS.density    = Number(val) / 10;
            if (name === 'startColor') PARAMS.startColor = val;
            if (name === 'endColor')   PARAMS.endColor   = val;
            if (name === 'palette')    PARAMS.palette = Array.isArray(val) && val.length ? val : PARAMS.palette;
        }
    };

    function setSliderById(id, val) {
        var pdef = api.params.find(function(x){ return x.id === id; });
        if (pdef) pdef.value = val;
        var el = document.getElementById(id);
        if (el) { el.value = val; }
        var vEl = document.getElementById(id + 'Value');
        if (vEl) vEl.textContent = val;
    }

    function resizeIfNeeded() {
        paper.resizeCanvasToPaper(p, PARAMS.paperSize);
    }

    p.registerSketchAPI = function(register) {
        if (typeof register === 'function') register(api);
    };

    p.setup = function() {
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize);
        canvas.parent(document.getElementById('make-sketch'));
        p.pixelDensity(1);
        p.noLoop();
    };

    p.draw = function() {
        p.background(255);
        p.noiseSeed(PARAMS.fieldSeed);

        // paper border
        paper.drawPaperBorder(p);

        var marginPx  = paper.getMarginPixels(PARAMS.margin);
        var paddingPx = paper.mmToPixels(PARAMS.paddingMm);
        var cellSize  = PARAMS.circleSize;
        var pitch     = cellSize + paddingPx;
        var availW    = p.width  - 2 * marginPx;
        var availH    = p.height - 2 * marginPx;
        var grid      = resolveGrid(availW, availH, pitch, PARAMS.composition);
        var cols      = grid.cols;
        var rows      = grid.rows;
        var contentW  = cols * cellSize + Math.max(0, cols - 1) * paddingPx;
        var contentH  = rows * cellSize + Math.max(0, rows - 1) * paddingPx;
        var offsetX   = marginPx + (availW - contentW) / 2;
        var offsetY   = marginPx + (availH - contentH) / 2;

        // gradient direction
        var gradRad = p.radians(PARAMS.gradAngle);
        var gdx = Math.cos(gradRad), gdy = Math.sin(gradRad);

        var pMin = Infinity, pMax = -Infinity;
        for (var i = 0; i < cols; i++) {
            for (var j = 0; j < rows; j++) {
                var proj = (offsetX + (i + 0.5) * cellSize) * gdx +
                           (offsetY + (j + 0.5) * cellSize) * gdy;
                if (proj < pMin) pMin = proj;
                if (proj > pMax) pMax = proj;
            }
        }

        p.blendMode(PARAMS.viewMode === 'multiply' ? p.MULTIPLY : p.BLEND);
        p.strokeWeight(Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm)));
        for (var i = 0; i < cols; i++) {
            for (var j = 0; j < rows; j++) {
                var cx = offsetX + i * (cellSize + paddingPx) + cellSize / 2;
                var cy = offsetY + j * (cellSize + paddingPx) + cellSize / 2;
                var t  = (pMax > pMin) ? ((cx * gdx + cy * gdy) - pMin) / (pMax - pMin) : 0;
                var weights = paletteWeightsAt(t);
                var angle = p.noise(i * PARAMS.noiseScale, j * PARAMS.noiseScale) * p.TWO_PI;
                p.randomSeed(cellSeed(i, j));
                if (PARAMS.shape === 'boxes') {
                    p.push();
                    p.translate(cx, cy);
                    var boxTheta = p.radians(PARAMS.boxRotationDeg);
                    if (PARAMS.boxRotationMode === 'field') boxTheta += angle;
                    drawLineBox(cellSize * 0.92, cellSize * 0.92, weights, angle, boxTheta);
                    p.pop();
                } else {
                    p.push();
                    p.translate(cx, cy);
                    drawLineCircle(cellSize * 0.92, weights, angle);
                    p.pop();
                }
            }
        }
        p.blendMode(p.BLEND);
    };

    function drawLineCircle(d, weights, theta) {
        var r = d / 2;
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        p.push();
        p.rotate(theta);
        for (var yloc = 0; yloc < r; yloc += stepSize) {
            var xloc = Math.sqrt(Math.max(0, r * r - yloc * yloc));
            p.stroke(getRandomColor(weights));
            p.line(-xloc,  yloc, xloc,  yloc);
            if (yloc > 0) {
                p.stroke(getRandomColor(weights));
                p.line(-xloc, -yloc, xloc, -yloc);
            }
        }
        p.pop();
    }

    function exportLineCircle(parts, cx, cy, d, weights, theta, strokeW, rng) {
        var r = d / 2;
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        var cosT = Math.cos(theta);
        var sinT = Math.sin(theta);
        for (var yloc = 0; yloc < r; yloc += stepSize) {
            var xloc = Math.sqrt(Math.max(0, r * r - yloc * yloc));
            appendRotatedLine(parts, cx, cy, -xloc, yloc, xloc, yloc, cosT, sinT, pickFromWeights(weights, rng), strokeW);
            if (yloc > 0) {
                appendRotatedLine(parts, cx, cy, -xloc, -yloc, xloc, -yloc, cosT, sinT, pickFromWeights(weights, rng), strokeW);
            }
        }
    }

    function drawLineBox(w, h, weights, theta, boxTheta) {
        var halfW = w / 2;
        var halfH = h / 2;
        var relTheta = theta - boxTheta;
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        var maxOffset = Math.abs(halfW * Math.sin(relTheta)) + Math.abs(halfH * Math.cos(relTheta));
        p.push();
        p.rotate(boxTheta);
        for (var yloc = 0; yloc <= maxOffset; yloc += stepSize) {
            drawClippedBoxLine(halfW, halfH, yloc, relTheta, weights);
            if (yloc > 0) {
                drawClippedBoxLine(halfW, halfH, -yloc, relTheta, weights);
            }
        }
        p.pop();
    }

    function exportLineBox(parts, cx, cy, w, h, weights, theta, boxTheta, strokeW, rng) {
        var halfW = w / 2;
        var halfH = h / 2;
        var relTheta = theta - boxTheta;
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        var maxOffset = Math.abs(halfW * Math.sin(relTheta)) + Math.abs(halfH * Math.cos(relTheta));
        var cosB = Math.cos(boxTheta);
        var sinB = Math.sin(boxTheta);

        for (var yloc = 0; yloc <= maxOffset; yloc += stepSize) {
            appendBoxExportLine(parts, cx, cy, halfW, halfH, yloc, relTheta, cosB, sinB, weights, strokeW, rng);
            if (yloc > 0) {
                appendBoxExportLine(parts, cx, cy, halfW, halfH, -yloc, relTheta, cosB, sinB, weights, strokeW, rng);
            }
        }
    }

    function drawClippedBoxLine(halfW, halfH, yloc, theta, weights) {
        var cosT = Math.cos(theta);
        var sinT = Math.sin(theta);
        var lineHalf = Math.sqrt(halfW * halfW + halfH * halfH) * 1.5;
        var x1 = -lineHalf;
        var y1 = yloc;
        var x2 = lineHalf;
        var y2 = yloc;

        var ax = x1 * cosT - y1 * sinT;
        var ay = x1 * sinT + y1 * cosT;
        var bx = x2 * cosT - y2 * sinT;
        var by = x2 * sinT + y2 * cosT;

        var clipped = clipLineToRect(ax, ay, bx, by, -halfW, halfW, -halfH, halfH);
        if (!clipped) return;

        p.stroke(getRandomColor(weights));
        p.line(clipped.x1, clipped.y1, clipped.x2, clipped.y2);
    }

    function appendBoxExportLine(parts, cx, cy, halfW, halfH, yloc, theta, cosB, sinB, weights, strokeW, rng) {
        var cosT = Math.cos(theta);
        var sinT = Math.sin(theta);
        var lineHalf = Math.sqrt(halfW * halfW + halfH * halfH) * 1.5;
        var x1 = -lineHalf;
        var y1 = yloc;
        var x2 = lineHalf;
        var y2 = yloc;

        var ax = x1 * cosT - y1 * sinT;
        var ay = x1 * sinT + y1 * cosT;
        var bx = x2 * cosT - y2 * sinT;
        var by = x2 * sinT + y2 * cosT;
        var clipped = clipLineToRect(ax, ay, bx, by, -halfW, halfW, -halfH, halfH);
        if (!clipped) return;

        var gx1 = cx + clipped.x1 * cosB - clipped.y1 * sinB;
        var gy1 = cy + clipped.x1 * sinB + clipped.y1 * cosB;
        var gx2 = cx + clipped.x2 * cosB - clipped.y2 * sinB;
        var gy2 = cy + clipped.x2 * sinB + clipped.y2 * cosB;
        appendSvgLine(parts, gx1, gy1, gx2, gy2, pickFromWeights(weights, rng), strokeW);
    }

    function clipLineToRect(x1, y1, x2, y2, xmin, xmax, ymin, ymax) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var t0 = 0;
        var t1 = 1;
        var checks = [
            { p: -dx, q: x1 - xmin },
            { p:  dx, q: xmax - x1 },
            { p: -dy, q: y1 - ymin },
            { p:  dy, q: ymax - y1 }
        ];

        for (var i = 0; i < checks.length; i++) {
            var entry = checks[i];
            if (entry.p === 0) {
                if (entry.q < 0) return null;
                continue;
            }
            var t = entry.q / entry.p;
            if (entry.p < 0) {
                if (t > t1) return null;
                if (t > t0) t0 = t;
            } else {
                if (t < t0) return null;
                if (t < t1) t1 = t;
            }
        }

        return {
            x1: x1 + t0 * dx,
            y1: y1 + t0 * dy,
            x2: x1 + t1 * dx,
            y2: y1 + t1 * dy
        };
    }

    function resolveGrid(availW, availH, cellSize, composition) {
        var baseCols = Math.max(1, Math.floor(availW / cellSize));
        var baseRows = Math.max(1, Math.floor(availH / cellSize));
        var totalCells = Math.max(1, baseCols * baseRows);
        var pageRatio = baseCols / Math.max(1, baseRows);
        var horizontalRatio = Math.max(pageRatio, totalCells);
        var verticalRatio = Math.min(pageRatio, 1 / totalCells);
        var t = composition / 100;
        var targetRatio;

        if (t < 0.5) {
            targetRatio = expLerp(horizontalRatio, pageRatio, t / 0.5);
        } else if (t > 0.5) {
            targetRatio = expLerp(pageRatio, verticalRatio, (t - 0.5) / 0.5);
        } else {
            targetRatio = pageRatio;
        }

        var cols = Math.max(1, Math.round(Math.sqrt(totalCells * targetRatio)));
        var rows = Math.max(1, Math.round(totalCells / cols));

        while (cols * cellSize > availW && cols > 1) cols--;
        while (rows * cellSize > availH && rows > 1) rows--;

        if (cols < 1) cols = 1;
        if (rows < 1) rows = 1;

        return { cols: cols, rows: rows };
    }

    function expLerp(a, b, t) {
        return Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t);
    }

    function cellSeed(i, j) {
        return Math.abs(
            ((PARAMS.fieldSeed + 1) * 73856093) ^
            ((i + 1) * 19349663) ^
            ((j + 1) * 83492791)
        );
    }

    function getRandomColor(weights) {
        var c = p.color(pickFromWeights(weights, function(){ return p.random(); }));
        if (PARAMS.viewMode === 'multiply') c.setAlpha(204);
        return c;
    }

    function appendRotatedLine(parts, cx, cy, x1, y1, x2, y2, cosT, sinT, stroke, strokeW) {
        var gx1 = cx + x1 * cosT - y1 * sinT;
        var gy1 = cy + x1 * sinT + y1 * cosT;
        var gx2 = cx + x2 * cosT - y2 * sinT;
        var gy2 = cy + x2 * sinT + y2 * cosT;
        appendSvgLine(parts, gx1, gy1, gx2, gy2, stroke, strokeW);
    }

    function appendSvgLine(parts, x1, y1, x2, y2, stroke, strokeW) {
        parts.push('<line x1="' + fmt(x1) + '" y1="' + fmt(y1) + '" x2="' + fmt(x2) + '" y2="' + fmt(y2) + '" stroke="' + stroke + '" stroke-width="' + fmt(strokeW) + '" stroke-linecap="square" fill="none"/>');
    }

    function fmt(n) {
        return Number(n).toFixed(3);
    }

    function makeRng(seed) {
        var state = (seed >>> 0) || 1;
        return function() {
            state = (1664525 * state + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    function downloadSvgString(str, filename) {
        var blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            a.remove();
            URL.revokeObjectURL(url);
        }, 1000);
    }
};
