window.sketches = window.sketches || {};
window.sketches['patternTest'] = function(p) {
    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize: '9x12',
        margin: 0.5,
        patternSet: 'all',
        cellSize: 118,
        scale: 1,
        rotation: 0,
        gapX: 22,
        gapY: 44,
        jitter: 0.18,
        penWidthMm: 0.4,
        palette: ['#000000', '#e63946', '#2196f3', '#4caf50', '#9c27b0'],
        showLabels: 'on'
    };

    var PATTERNS = [
        { id: 'art-arcs',       label: 'Arc bands',    set: 'artproofs' },
        { id: 'art-hatch',      label: 'Hatch',        set: 'artproofs' },
        { id: 'art-crosshatch', label: 'Crosshatch',   set: 'artproofs' },
        { id: 'art-sketch',     label: 'Sketch hatch', set: 'artproofs' },
        { id: 'art-streak',     label: 'Streak hatch', set: 'artproofs' },
        { id: 'art-zigzag',     label: 'Zigzag hatch', set: 'artproofs' },
        { id: 'art-waves',      label: 'Waves',        set: 'artproofs' },
        { id: 'art-sprig',      label: 'Sprig tile',   set: 'artproofs' },
        { id: 'art-ribbon',     label: 'Ribbon tile',  set: 'artproofs' },
        { id: 'art-dots',       label: 'Dots',         set: 'artproofs' },
        { id: 'whirl-hatch',    label: 'Whirl hatch',  set: 'whirls' },
        { id: 'whirl-sketch',   label: 'Whirl sketch', set: 'whirls' },
        { id: 'whirl-streak',   label: 'Whirl streak', set: 'whirls' },
        { id: 'whirl-zigzag',   label: 'Whirl zigzag', set: 'whirls' }
    ];

    var seed = 12345;

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'patternSet', label: 'Pattern set', type: 'select', value: PARAMS.patternSet,
              options: [
                { value: 'all', label: 'All' },
                { value: 'artproofs', label: 'Artproofs fills' },
                { value: 'whirls', label: 'Whirls fills' }
              ] },
            { id: 'palette', label: 'Colors', type: 'colorPalette', maxSelect: 6,
              value: PARAMS.palette.slice(),
              options: [
                { value: '#000000', label: 'Black' },
                { value: '#e63946', label: 'Red' },
                { value: '#2196f3', label: 'Blue' },
                { value: '#ff9800', label: 'Orange' },
                { value: '#4caf50', label: 'Green' },
                { value: '#9c27b0', label: 'Purple' },
                { value: '#00ffff', label: 'Cyan' },
                { value: '#ff00ff', label: 'Magenta' },
                { value: '#ffff00', label: 'Yellow' },
                { value: 'custom', label: 'Custom' }
              ] },
            { id: 'cellSize', label: 'Cell size', type: 'range', min: 60, max: 180, step: 2, value: PARAMS.cellSize },
            { id: 'scale', label: 'Pattern scale', type: 'range', min: 40, max: 220, step: 5, value: 100,
              _toInternal: function(v) { return Number(v) / 100; } },
            { id: 'rotation', label: 'Rotation deg', type: 'range', min: -90, max: 90, step: 1, value: PARAMS.rotation },
            { id: 'gapX', label: 'Grid X gap', type: 'range', min: 0, max: 90, step: 2, value: PARAMS.gapX },
            { id: 'gapY', label: 'Grid Y gap', type: 'range', min: 12, max: 110, step: 2, value: PARAMS.gapY },
            { id: 'jitter', label: 'Imperfection', type: 'range', min: 0, max: 100, step: 1, value: 18,
              _toInternal: function(v) { return Number(v) / 100; } },
            { id: 'penWidthMm', label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: PARAMS.penWidthMm },
            { id: 'showLabels', label: 'Labels', type: 'select', value: PARAMS.showLabels,
              options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        reseed: function() { seed = Math.floor(Math.random() * 1e8) + 1; p.redraw(); },
        getRecipe: function() { return { state: { seed: seed } }; },
        applyRecipeState: function(state) {
            if (state && Number.isFinite(Number(state.seed))) seed = Number(state.seed);
            p.redraw();
        },
        setParam: function(name, rawVal) {
            var pdef = api.params.find(function(x) { return x.id === name; });
            if (pdef) pdef.value = rawVal;
            var val = (pdef && pdef._toInternal) ? pdef._toInternal(rawVal) : rawVal;
            if (name === 'paperSize') { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin') PARAMS.margin = Number(val);
            if (name === 'patternSet') PARAMS.patternSet = val;
            if (name === 'cellSize') PARAMS.cellSize = Number(val);
            if (name === 'scale') PARAMS.scale = Number(val);
            if (name === 'rotation') PARAMS.rotation = Number(val);
            if (name === 'gapX') PARAMS.gapX = Number(val);
            if (name === 'gapY') PARAMS.gapY = Number(val);
            if (name === 'jitter') PARAMS.jitter = Number(val);
            if (name === 'penWidthMm') PARAMS.penWidthMm = Number(val);
            if (name === 'showLabels') PARAMS.showLabels = val;
            if (name === 'palette') PARAMS.palette = Array.isArray(val) && val.length ? val : PARAMS.palette;
        },
        saveSVG: function() { exportSVG(); }
    };

    function resizeIfNeeded() { paper.resizeCanvasToPaper(p, PARAMS.paperSize); }

    p.registerSketchAPI = function(register) { if (typeof register === 'function') register(api); };

    p.setup = function() {
        paper.createPaperCanvas(p, PARAMS.paperSize).parent(document.getElementById('make-sketch'));
        p.pixelDensity(1);
        p.noLoop();
    };

    function activePatterns() {
        return PATTERNS.filter(function(pattern) {
            return PARAMS.patternSet === 'all' || pattern.set === PARAMS.patternSet;
        });
    }

    function layoutCells() {
        var m = paper.getMarginPixels(PARAMS.margin);
        var labelH = PARAMS.showLabels === 'on' ? 18 : 0;
        var stepX = PARAMS.cellSize + PARAMS.gapX;
        var stepY = PARAMS.cellSize + PARAMS.gapY + labelH;
        var cols = Math.max(1, Math.floor((p.width - 2 * m + PARAMS.gapX) / stepX));
        var patterns = activePatterns();
        var cells = [];
        for (var i = 0; i < patterns.length; i++) {
            var col = i % cols;
            var row = Math.floor(i / cols);
            cells.push({
                pattern: patterns[i],
                x: m + col * stepX,
                y: m + row * stepY,
                w: PARAMS.cellSize,
                h: PARAMS.cellSize
            });
        }
        return cells;
    }

    p.draw = function() {
        p.background(255);
        paper.drawPaperBorder(p);
        var cells = layoutCells();
        var strokeW = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        for (var i = 0; i < cells.length; i++) drawCell(cells[i], i, strokeW);
    };

    function drawCell(cell, index, strokeW) {
        var color = PARAMS.palette[index % PARAMS.palette.length] || '#000000';
        var geom = patternGeometry(cell.pattern.id, cell.x, cell.y, cell.w, cell.h, index);
        p.push();
        p.noFill();
        p.stroke(color);
        p.strokeWeight(strokeW);
        p.strokeCap(p.ROUND);
        geom.lines.forEach(function(ln) {
            p.line(ln.x1, ln.y1, ln.x2, ln.y2);
        });
        geom.circles.forEach(function(c) {
            p.circle(c.x, c.y, c.r * 2);
        });
        p.stroke('#bbbbbb');
        p.strokeWeight(1);
        p.rect(cell.x, cell.y, cell.w, cell.h);
        if (PARAMS.showLabels === 'on') {
            p.noStroke();
            p.fill(70);
            p.textSize(11);
            p.textAlign(p.CENTER, p.TOP);
            p.text(cell.pattern.label, cell.x + cell.w / 2, cell.y + cell.h + 5);
        }
        p.pop();
    }

    function rectPoly(x, y, w, h) {
        return [{x:x,y:y}, {x:x+w,y:y}, {x:x+w,y:y+h}, {x:x,y:y+h}];
    }

    function lineEdgeT(ax, ay, dx, dy, ex, ey, fx, fy) {
        var gx = fx - ex, gy = fy - ey;
        var denom = dx * gy - dy * gx;
        if (Math.abs(denom) < 1e-10) return null;
        var t = ((ex - ax) * gy - (ey - ay) * gx) / denom;
        var s = ((ex - ax) * dy - (ey - ay) * dx) / denom;
        return (s >= -1e-6 && s <= 1 + 1e-6) ? t : null;
    }

    function pointInPoly(pt, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if (((yi > pt.y) !== (yj > pt.y)) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    function clipSegmentToPoly(x1, y1, x2, y2, poly) {
        var dx = x2 - x1, dy = y2 - y1;
        var ts = [0, 1];
        for (var i = 0; i < poly.length; i++) {
            var t = lineEdgeT(x1, y1, dx, dy, poly[i].x, poly[i].y, poly[(i + 1) % poly.length].x, poly[(i + 1) % poly.length].y);
            if (t !== null && t >= 0 && t <= 1) ts.push(t);
        }
        ts.sort(function(a, b) { return a - b; });
        var out = [];
        for (var j = 0; j + 1 < ts.length; j++) {
            var a = ts[j], b = ts[j + 1];
            var mid = (a + b) / 2;
            if (b - a > 1e-5 && pointInPoly({ x: x1 + dx * mid, y: y1 + dy * mid }, poly)) {
                out.push({ x1: x1 + dx * a, y1: y1 + dy * a, x2: x1 + dx * b, y2: y1 + dy * b });
            }
        }
        return out;
    }

    function hatchSegs(poly, angleDeg, spacing) {
        var ang = angleDeg * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var nx = -dy, ny = dx;
        var pMin = Infinity, pMax = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            var proj = poly[i].x * nx + poly[i].y * ny;
            pMin = Math.min(pMin, proj);
            pMax = Math.max(pMax, proj);
        }
        var segs = [];
        for (var k = Math.floor(pMin / spacing); k * spacing <= pMax; k++) {
            var off = k * spacing;
            Array.prototype.push.apply(segs, clipSegmentToPoly(off * nx - 9999 * dx, off * ny - 9999 * dy, off * nx + 9999 * dx, off * ny + 9999 * dy, poly));
        }
        return segs;
    }

    function noisySegments(lines, spacing, phase, wobble, broken) {
        var out = [];
        lines.forEach(function(ln, i) {
            var dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
            var len = Math.hypot(dx, dy);
            if (len < 1) return;
            var nx = -dy / len, ny = dx / len;
            var pieces = broken ? Math.max(2, Math.min(7, Math.floor(len / Math.max(4, spacing * 2.2)))) : 1;
            for (var j = 0; j < pieces; j++) {
                var a = pieces === 1 ? 0.02 : j / pieces + 0.08;
                var b = pieces === 1 ? 0.98 : Math.min(0.98, (j + 0.62) / pieces);
                var o1 = wobble * Math.sin(phase + i * 0.91 + j * 2.4);
                var o2 = wobble * Math.sin(phase + i * 1.23 + j * 2.9 + 1.7);
                out.push({ x1: ln.x1 + dx * a + nx * o1, y1: ln.y1 + dy * a + ny * o1, x2: ln.x1 + dx * b + nx * o2, y2: ln.y1 + dy * b + ny * o2 });
            }
        });
        return out;
    }

    function zigzagSegs(poly, angleDeg, spacing, phase) {
        var base = hatchSegs(poly, angleDeg, spacing * 1.1);
        var out = [];
        base.forEach(function(ln, i) {
            var dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
            var len = Math.hypot(dx, dy);
            if (len < 2) return;
            var nx = -dy / len, ny = dx / len;
            var steps = Math.max(2, Math.min(14, Math.ceil(len / Math.max(7, spacing * 1.4))));
            var prev = null;
            for (var s = 0; s <= steps; s++) {
                var t = s / steps;
                var side = (s + i) % 2 === 0 ? -1 : 1;
                var off = side * spacing * 0.45 + Math.sin(phase + s * 1.7 + i) * spacing * 0.08;
                var pt = { x: ln.x1 + dx * t + nx * off, y: ln.y1 + dy * t + ny * off };
                if (prev) Array.prototype.push.apply(out, clipSegmentToPoly(prev.x, prev.y, pt.x, pt.y, poly));
                prev = pt;
            }
        });
        return out;
    }

    function waveSegs(poly, angleDeg, spacing, phase) {
        var ang = angleDeg * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var nx = -dy, ny = dx;
        var pMin = Infinity, pMax = -Infinity, tMin = Infinity, tMax = -Infinity;
        poly.forEach(function(pt) {
            var pv = pt.x * nx + pt.y * ny;
            var tv = pt.x * dx + pt.y * dy;
            pMin = Math.min(pMin, pv); pMax = Math.max(pMax, pv);
            tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv);
        });
        var out = [];
        var amp = spacing * 0.5;
        var freq = Math.PI * 2 / (spacing * 3.5);
        for (var k = Math.floor(pMin / spacing); k * spacing <= pMax; k++) {
            var pts = [];
            var samples = Math.max(8, Math.min(34, Math.ceil((tMax - tMin) / (spacing * 0.95))));
            for (var s = 0; s <= samples; s++) {
                var tv = tMin + (tMax - tMin) * s / samples;
                var off = amp * Math.sin(freq * tv + phase + k * 1.3);
                pts.push({ x: (k * spacing + off) * nx + tv * dx, y: (k * spacing + off) * ny + tv * dy });
            }
            for (var j = 0; j + 1 < pts.length; j++) Array.prototype.push.apply(out, clipSegmentToPoly(pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y, poly));
        }
        return out;
    }

    function tileSegs(poly, angleDeg, spacing, phase, mode) {
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        poly.forEach(function(pt) { minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x); minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y); });
        var tile = Math.max(spacing * 3.2, 16);
        var ang = angleDeg * Math.PI / 180;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var out = [];
        function add(cx, cy, ax, ay, bx, by) {
            var x1 = cx + ax * ca - ay * sa, y1 = cy + ax * sa + ay * ca;
            var x2 = cx + bx * ca - by * sa, y2 = cy + bx * sa + by * ca;
            Array.prototype.push.apply(out, clipSegmentToPoly(x1, y1, x2, y2, poly));
        }
        for (var y = Math.floor((minY - tile) / tile) * tile; y <= maxY + tile; y += tile) {
            for (var x = Math.floor((minX - tile) / tile) * tile; x <= maxX + tile; x += tile) {
                var cx = x + tile * 0.5 + Math.sin(x * 0.013 + y * 0.017 + phase) * tile * PARAMS.jitter * 0.5;
                var cy = y + tile * 0.5 + Math.cos(x * 0.011 - y * 0.019 + phase) * tile * PARAMS.jitter * 0.5;
                if (mode === 'ribbon') {
                    add(cx, cy, -tile * 0.35, -tile * 0.18, -tile * 0.05,  tile * 0.18);
                    add(cx, cy, -tile * 0.05,  tile * 0.18,  tile * 0.35, -tile * 0.18);
                    add(cx, cy, -tile * 0.34,  tile * 0.20,  tile * 0.34,  tile * 0.20);
                } else {
                    add(cx, cy, -tile * 0.30,  tile * 0.30,  tile * 0.28, -tile * 0.28);
                    add(cx, cy, -tile * 0.02,  tile * 0.02, -tile * 0.24, -tile * 0.08);
                    add(cx, cy,  tile * 0.08, -tile * 0.08,  tile * 0.30,  tile * 0.02);
                    add(cx, cy,  tile * 0.18, -tile * 0.18,  tile * 0.02, -tile * 0.32);
                }
            }
        }
        return out;
    }

    function arcBandSegs(x, y, w, h, count) {
        var out = [];
        var cx = x + w / 2, cy = y + h / 2;
        var maxR = Math.min(w, h) * 0.48;
        for (var i = 1; i <= count; i++) {
            var r = maxR * i / (count + 1);
            var prev = null;
            var steps = 28;
            for (var s = 0; s <= steps; s++) {
                var a = -Math.PI * 0.82 + Math.PI * 1.64 * s / steps;
                var pt = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
                if (prev) out.push({ x1: prev.x, y1: prev.y, x2: pt.x, y2: pt.y });
                prev = pt;
            }
        }
        return out;
    }

    function dotCircles(poly, x, y, w, h, spacing, mixed) {
        var circles = [];
        for (var yy = y + spacing * 0.65; yy < y + h; yy += spacing) {
            for (var xx = x + spacing * 0.65; xx < x + w; xx += spacing) {
                var jx = Math.sin(xx * 0.027 + yy * 0.019 + seed) * spacing * PARAMS.jitter * 0.35;
                var jy = Math.cos(xx * 0.017 - yy * 0.031 + seed) * spacing * PARAMS.jitter * 0.35;
                var pt = { x: xx + jx, y: yy + jy };
                if (pointInPoly(pt, poly)) {
                    var tone = 0.5 + 0.5 * Math.sin(xx * 0.041 + yy * 0.037 + seed);
                    circles.push({ x: pt.x, y: pt.y, r: spacing * (mixed ? 0.12 + tone * 0.33 : 0.22) });
                }
            }
        }
        return circles;
    }

    function patternGeometry(id, x, y, w, h, index) {
        var poly = rectPoly(x, y, w, h);
        var spacing = Math.max(4, 13 * PARAMS.scale);
        var angle = PARAMS.rotation + (id.indexOf('whirl-') === 0 ? 22 : 0);
        var phase = seed * 0.001 + index * 1.73;
        var lines = [];
        var circles = [];
        if (id === 'art-arcs') lines = arcBandSegs(x, y, w, h, 6);
        else if (id === 'art-hatch' || id === 'whirl-hatch') lines = hatchSegs(poly, angle, spacing);
        else if (id === 'art-crosshatch') lines = hatchSegs(poly, angle, spacing).concat(hatchSegs(poly, angle + 90, spacing));
        else if (id === 'art-sketch' || id === 'whirl-sketch') lines = noisySegments(hatchSegs(poly, angle, spacing), spacing, phase, spacing * PARAMS.jitter * 0.35, false);
        else if (id === 'art-streak' || id === 'whirl-streak') lines = noisySegments(hatchSegs(poly, angle, spacing), spacing, phase, spacing * PARAMS.jitter * 0.85, true);
        else if (id === 'art-zigzag' || id === 'whirl-zigzag') lines = zigzagSegs(poly, angle, spacing, phase);
        else if (id === 'art-waves') lines = waveSegs(poly, angle, spacing, phase);
        else if (id === 'art-sprig') lines = tileSegs(poly, angle, spacing, phase, 'sprig');
        else if (id === 'art-ribbon') lines = tileSegs(poly, angle, spacing, phase, 'ribbon');
        else if (id === 'art-dots') circles = dotCircles(poly, x, y, w, h, spacing, true);
        return { lines: lines, circles: circles };
    }

    function exportSVG() {
        var dims = paper.getPaperPixels(PARAMS.paperSize);
        var strokeW = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        var cells = layoutCells();
        var ts = new Date().toISOString().replace(/[:.]/g, '-');
        var parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + dims.width + '" height="' + dims.height + '" viewBox="0 0 ' + dims.width + ' ' + dims.height + '">',
            '<g>'
        ];
        for (var i = 0; i < cells.length; i++) {
            var color = PARAMS.palette[i % PARAMS.palette.length] || '#000000';
            var geom = patternGeometry(cells[i].pattern.id, cells[i].x, cells[i].y, cells[i].w, cells[i].h, i);
            geom.lines.forEach(function(ln) {
                parts.push('<line x1="' + fmt(ln.x1) + '" y1="' + fmt(ln.y1) + '" x2="' + fmt(ln.x2) + '" y2="' + fmt(ln.y2) + '" stroke="' + color + '" stroke-width="' + fmt(strokeW) + '" stroke-linecap="round"/>');
            });
            geom.circles.forEach(function(c) {
                parts.push('<circle cx="' + fmt(c.x) + '" cy="' + fmt(c.y) + '" r="' + fmt(c.r) + '" fill="none" stroke="' + color + '" stroke-width="' + fmt(strokeW) + '"/>');
            });
        }
        parts.push('</g></svg>');
        downloadSvg(parts.join('\n'), '90percentart-pattern-test-' + ts + '.svg');
    }

    function fmt(n) { return Number(n).toFixed(3); }

    function downloadSvg(str, filename) {
        var blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { a.remove(); URL.revokeObjectURL(url); }, 1000);
    }
};
