window.sketches = window.sketches || {};
window.sketches['cmyk'] = function(p) {

    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize:  '8.5x11',
        margin:     1,
        shape:      'boxes',
        fieldSeed:  1,
        circleSize: 50,
        paddingMm:  0,
        boxRotationDeg: 0,
        boxRotationMode: 'clean',
        composition: 50,
        penWidthMm: 0.4,
        noiseScale: 0.10,
        gradAngle:  0,
        density:    2,          // lines per mm
        startCMYK: [0, 18, 34, 37],
        endCMYK:   [34, 16, 0,  37]
    };

    // Convert a hex color string to [C, M, Y, K] probability weights (each 0–100)
    function hexToCMYK(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255;
        var g = parseInt(hex.slice(3, 5), 16) / 255;
        var b = parseInt(hex.slice(5, 7), 16) / 255;
        var k = 1 - Math.max(r, g, b);
        if (k >= 1) return [0, 0, 0, 100];
        var d = 1 - k;
        return [
            Math.round((1 - r - k) / d * 100),
            Math.round((1 - g - k) / d * 100),
            Math.round((1 - b - k) / d * 100),
            Math.round(k * 100)
        ];
    }

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'shape', label: 'Shape', type: 'select', value: 'boxes',
              options: [
                { value: 'boxes', label: 'Boxes' },
                { value: 'circles', label: 'Circles' }
              ]},
            { id: 'circleSize', label: 'Shape size (px)', type: 'range', min: 15, max: 150, step: 5,  value: 50  },
            { id: 'paddingMm', label: 'Padding (mm)', type: 'range', min: 0, max: 10, step: 0.1, value: 0,
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
            { id: 'gradAngle',  label: 'Gradient angle°', type: 'range', min: 0,   max: 355, step: 5,   value: 0   },
            { id: 'density',    label: 'Density (ln/mm)', type: 'range', min: 10,  max: 30,  step: 1,   value: 20,
              _toInternal: function(v){ return v / 10; } },
            { id: 'startColor', label: 'Start color', type: 'color', value: '#ff6600' },
            { id: 'endColor',   label: 'End color',   type: 'color', value: '#0066cc' }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        randomize: function() {
            PARAMS.fieldSeed = Math.floor(Math.random() * 1e6);
            var ang = Math.floor(Math.random() * 72) * 5;
            setSliderById('gradAngle', ang);
            PARAMS.gradAngle = ang;
            var comp = Math.floor(Math.random() * 61) + 20;
            setSliderById('composition', comp);
            PARAMS.composition = comp;
            var ns = Math.floor(Math.random() * 40) + 1;
            setSliderById('noiseScale', ns);
            PARAMS.noiseScale = ns / 100;
            resizeIfNeeded();
            p.redraw();
        },
        setParam: function(name, val) {
            var pdef = api.params.find(function(x){ return x.id === name; });
            if (pdef) pdef.value = val;
            if (name === 'paperSize')  { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin')     PARAMS.margin     = Number(val);
            if (name === 'shape')      PARAMS.shape = val;
            if (name === 'circleSize') PARAMS.circleSize = Number(val);
            if (name === 'paddingMm')  PARAMS.paddingMm = Number(val);
            if (name === 'boxRotationDeg') PARAMS.boxRotationDeg = Number(val);
            if (name === 'boxRotationMode') PARAMS.boxRotationMode = val;
            if (name === 'composition') PARAMS.composition = Number(val);
            if (name === 'penWidthMm') PARAMS.penWidthMm = Number(val);
            if (name === 'noiseScale') PARAMS.noiseScale = Number(val) / 100;
            if (name === 'gradAngle')  PARAMS.gradAngle  = Number(val);
            if (name === 'density')    PARAMS.density    = Number(val) / 10;
            if (name === 'startColor') PARAMS.startCMYK  = hexToCMYK(val);
            if (name === 'endColor')   PARAMS.endCMYK    = hexToCMYK(val);
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

        var startCMYK = PARAMS.startCMYK;
        var endCMYK   = PARAMS.endCMYK;

        p.strokeWeight(Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm)));
        for (var i = 0; i < cols; i++) {
            for (var j = 0; j < rows; j++) {
                var cx = offsetX + i * (cellSize + paddingPx) + cellSize / 2;
                var cy = offsetY + j * (cellSize + paddingPx) + cellSize / 2;
                var t  = (pMax > pMin) ? ((cx * gdx + cy * gdy) - pMin) / (pMax - pMin) : 0;
                var cmyk  = arrayLerp(startCMYK, endCMYK, t);
                var angle = p.noise(i * PARAMS.noiseScale, j * PARAMS.noiseScale) * p.TWO_PI;
                p.randomSeed(cellSeed(i, j));
                if (PARAMS.shape === 'boxes') {
                    p.push();
                    p.translate(cx, cy);
                    var boxTheta = p.radians(PARAMS.boxRotationDeg);
                    if (PARAMS.boxRotationMode === 'field') boxTheta += angle;
                    drawLineBox(cellSize * 0.92, cellSize * 0.92, cmyk, angle, boxTheta);
                    p.pop();
                } else {
                    p.push();
                    p.translate(cx, cy);
                    drawLineCircle(cellSize * 0.92, cmyk, angle);
                    p.pop();
                }
            }
        }
    };

    function drawLineCircle(d, cmyk, theta) {
        var r = d / 2;
        // convert lines/mm to px spacing at current DPI (100px = 1 inch = 25.4mm)
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        p.push();
        p.rotate(theta);
        for (var yloc = 0; yloc < r; yloc += stepSize) {
            var xloc = Math.sqrt(Math.max(0, r * r - yloc * yloc));
            p.stroke(getRandomColor(cmyk));
            p.line(-xloc,  yloc, xloc,  yloc);
            if (yloc > 0) {
                p.stroke(getRandomColor(cmyk));
                p.line(-xloc, -yloc, xloc, -yloc);
            }
        }
        p.pop();
    }

    function drawLineBox(w, h, cmyk, theta, boxTheta) {
        var halfW = w / 2;
        var halfH = h / 2;
        var relTheta = theta - boxTheta;
        var stepSize = (paper.DPI / 25.4) / PARAMS.density;
        var maxOffset = Math.abs(halfW * Math.sin(relTheta)) + Math.abs(halfH * Math.cos(relTheta));
        p.push();
        p.rotate(boxTheta);
        for (var yloc = 0; yloc <= maxOffset; yloc += stepSize) {
            drawClippedBoxLine(halfW, halfH, yloc, relTheta, cmyk);
            if (yloc > 0) {
                drawClippedBoxLine(halfW, halfH, -yloc, relTheta, cmyk);
            }
        }
        p.pop();
    }

    function drawClippedBoxLine(halfW, halfH, yloc, theta, cmyk) {
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

        p.stroke(getRandomColor(cmyk));
        p.line(clipped.x1, clipped.y1, clipped.x2, clipped.y2);
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

    function getRandomColor(cmyk) {
        var c = cmyk[0], m = cmyk[1], y = cmyk[2], k = cmyk[3];
        var total = c + m + y + k;
        if (total <= 0) return p.color(255);
        var rval = p.random(total);
        if (rval < c)         return p.color('cyan');
        if (rval < c + m)     return p.color('magenta');
        if (rval < c + m + y) return p.color('yellow');
        return p.color('black');
    }

    function arrayLerp(a, b, t) {
        var result = [];
        for (var k = 0; k < a.length; k++) result.push(a[k] * (1 - t) + b[k] * t);
        return result;
    }
};
