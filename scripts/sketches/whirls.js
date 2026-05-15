window.sketches = window.sketches || {};
window.sketches['whirls'] = function(p) {
    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize: '9x12',
        margin: 1,
        whirlCount: 8,
        cellLen: 40,
        cellWidth: 22,
        rowsBase: 3,
        rowsSpread: 0.5,
        fieldScale: 0.003,
        pathMode: 'flow',
        swirlStrength: 0.7,
        density: 2.0,
        showBorder: true,
        overlapMode: 'erase',
        fillStyle: 'solid',
        fillAngle: 0,
        fillJitter: 0.35,
        viewMode: 'normal',
        penWidthMm: 0.4,
        palette: ['#e63946', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#ffd600']
    };

    var whirls = [];
    var globalSeed = 1;
    var fieldAngleOffset = 0; // per-seed global rotation of the Perlin field
    var sharedSwirlCenter = null;

    function makeRng(seed) {
        var s = (seed >>> 0) || 1;
        return function() { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
    }

    function cellColorIdx(whirlIdx, segIdx, rowIdx) {
        return Math.abs(
            ((globalSeed | 0) * 73856093) ^
            ((whirlIdx + 1) * 19349663) ^
            ((segIdx + 1) * 83492791) ^
            ((rowIdx + 1) * 56982631)
        ) >>> 0;
    }

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'palette', label: 'Colors', type: 'colorPalette', maxSelect: 6,
              value: PARAMS.palette.slice(),
              options: [
                { value: '#00ffff', label: 'Cyan' }, { value: '#ff00ff', label: 'Magenta' },
                { value: '#ffff00', label: 'Yellow' },{ value: '#000000', label: 'Black' },
                { value: '#e63946', label: 'Red' },   { value: '#4caf50', label: 'Green' },
                { value: '#2196f3', label: 'Blue' },  { value: '#9c27b0', label: 'Purple' },
                { value: '#ff9800', label: 'Orange' },{ value: '#ffd600', label: 'Yellow' },
                { value: 'custom',  label: 'Custom' }
              ]},
            { id: 'whirlCount', label: 'Whirls',     type: 'range', min: 2,   max: 60,  step: 1,   value: 8 },
            { id: 'cellLen',    label: 'Cell length', type: 'range', min: 10,  max: 120, step: 2,   value: 40 },
            { id: 'cellWidth',  label: 'Lane width',  type: 'range', min: 6,   max: 80,  step: 2,   value: 22 },
            { id: 'rowsBase',   label: 'Rows',         type: 'range', min: 1,   max: 10,  step: 1,   value: 3 },
            { id: 'rowsSpread', label: 'Rows spread', type: 'range', min: 0,   max: 10,  step: 1,   value: 5,
              _toInternal: function(v) { return v / 10; } },
            { id: 'fieldScale', label: 'Turbulence',  type: 'range', min: 1,   max: 12,  step: 1,   value: 3,
              _toInternal: function(v) { return v / 1000; } },
            { id: 'pathMode', label: 'Path mode', type: 'select', value: 'flow',
              options: [
                { value: 'flow', label: 'Flow' },
                { value: 'sharedSwirl', label: 'Shared swirl' },
                { value: 'curlyq', label: 'Curlyq' }
              ] },
            { id: 'swirlStrength', label: 'Swirl pull', type: 'range', min: 0, max: 100, step: 1, value: 70,
              visibleWhen: { param: 'pathMode', values: ['sharedSwirl', 'curlyq'] },
              _toInternal: function(v) { return v / 100; } },
            { id: 'fillStyle', label: 'Fill texture', type: 'select', value: 'solid', group: 'textures',
              options: [
                { value: 'solid', label: 'Solid' },
                { value: 'hatch', label: 'Hatch' },
                { value: 'sketchHatch', label: 'Sketch hatch' },
                { value: 'streakHatch', label: 'Streak hatch' },
                { value: 'zigzagHatch', label: 'Zigzag hatch' }
              ] },
            { id: 'fillAngle', label: 'Fill angle offset', type: 'range', min: -90, max: 90, step: 1, value: 0, group: 'textures' },
            { id: 'fillJitter', label: 'Fill imperfection', type: 'range', min: 0, max: 100, step: 1, value: 35, group: 'textures',
              _toInternal: function(v) { return v / 100; } },
            { id: 'density',    label: 'Hatch density',type: 'range', min: 5,  max: 50,  step: 1,   value: 20, group: 'textures',
              _toInternal: function(v) { return v / 10; } },
            { id: 'showBorder', label: 'Cell border', type: 'select', value: 'on',
              options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
            { id: 'penWidthMm', label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: 0.4 }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        reseed: function() { globalSeed = Math.floor(Math.random() * 1e8) + 1; buildAllWhirls(); p.redraw(); },
        setParam: function(name, rawVal) {
            var pdef = api.params.find(function(x) { return x.id === name; });
            if (pdef) pdef.value = rawVal;
            var val = (pdef && pdef._toInternal) ? pdef._toInternal(rawVal) : rawVal;
            if (name === 'paperSize')   { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin')      PARAMS.margin = Number(val);
            if (name === 'whirlCount')  PARAMS.whirlCount = Number(val);
            if (name === 'cellLen')     PARAMS.cellLen = Number(val);
            if (name === 'cellWidth')   PARAMS.cellWidth = Number(val);
            if (name === 'rowsBase')    PARAMS.rowsBase = Number(val);
            if (name === 'rowsSpread')  PARAMS.rowsSpread = val;
            if (name === 'fieldScale')  PARAMS.fieldScale = val;
            if (name === 'pathMode')    PARAMS.pathMode = val;
            if (name === 'swirlStrength') PARAMS.swirlStrength = val;
            if (name === 'density')     PARAMS.density = val;
            if (name === 'showBorder')  PARAMS.showBorder = val === 'on';
            if (name === 'overlapMode') PARAMS.overlapMode = val;
            if (name === 'fillStyle')   PARAMS.fillStyle = val;
            if (name === 'fillAngle')   PARAMS.fillAngle = Number(val);
            if (name === 'fillJitter')  PARAMS.fillJitter = val;
            if (name === 'penWidthMm')  PARAMS.penWidthMm = Number(val);
            if (name === 'viewMode')    PARAMS.viewMode = val;
            if (name === 'palette')     { PARAMS.palette = Array.isArray(val) && val.length ? val : PARAMS.palette; }
            var rebuilds = ['whirlCount','cellLen','cellWidth','rowsBase','rowsSpread','fieldScale','pathMode','swirlStrength','paperSize','margin'];
            if (rebuilds.indexOf(name) !== -1) buildAllWhirls();
        },
        saveSVG: function() { exportSVG(); }
    };

    function resizeIfNeeded() { paper.resizeCanvasToPaper(p, PARAMS.paperSize); }

    // ---- geometry ----
    function segIntersectT(P, Q, A, B) {
        var rx=Q.x-P.x, ry=Q.y-P.y, sx=B.x-A.x, sy=B.y-A.y;
        var den = rx*sy - ry*sx;
        if (Math.abs(den) < 1e-10) return null;
        var t = ((A.x-P.x)*sy - (A.y-P.y)*sx) / den;
        var u = ((A.x-P.x)*ry - (A.y-P.y)*rx) / den;
        return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : null;
    }

    function pointInPoly(pt, poly) {
        var inside = false;
        for (var i = 0, j = poly.length-1; i < poly.length; j = i++) {
            var xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
            if (((yi > pt.y) !== (yj > pt.y)) && pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi)
                inside = !inside;
        }
        return inside;
    }

    function clipLineOutsidePoly(x1, y1, x2, y2, poly) {
        var dx=x2-x1, dy=y2-y1;
        var ts=[0,1];
        var P={x:x1,y:y1}, Q={x:x2,y:y2};
        for (var i=0; i<poly.length; i++) {
            var t = segIntersectT(P, Q, poly[i], poly[(i+1)%poly.length]);
            if (t !== null) ts.push(t);
        }
        ts.sort(function(a,b){return a-b;});
        var out=[];
        for (var j=0; j+1<ts.length; j++) {
            var tm=(ts[j]+ts[j+1])/2;
            if (!pointInPoly({x:x1+tm*dx, y:y1+tm*dy}, poly))
                out.push({x1:x1+ts[j]*dx, y1:y1+ts[j]*dy, x2:x1+ts[j+1]*dx, y2:y1+ts[j+1]*dy});
        }
        return out;
    }

    // ---- path generation ----
    function normalAt(path, i) {
        var a=path[Math.max(0,i-1)], b=path[Math.min(path.length-1,i+1)];
        var dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1;
        return {x:-dy/len, y:dx/len};
    }

    function normAngleDiff(target, current) {
        var diff = target - current;
        return diff - Math.PI * 2 * Math.floor((diff + Math.PI) / (Math.PI * 2));
    }

    function mixAngles(a, b, amount) {
        return a + normAngleDiff(b, a) * Math.max(0, Math.min(1, amount));
    }

    function chooseSwirlCenter(rng, w, h, sx, sy) {
        if (PARAMS.pathMode === 'sharedSwirl') {
            return sharedSwirlCenter;
        }
        if (PARAMS.pathMode === 'curlyq') {
            var radius = Math.min(w, h) * (0.08 + rng() * 0.2);
            var a = rng() * Math.PI * 2;
            return {
                x: sx + Math.cos(a) * radius,
                y: sy + Math.sin(a) * radius,
                dir: rng() < 0.5 ? -1 : 1,
                targetRadius: radius * (0.55 + rng() * 0.9)
            };
        }
        return null;
    }

    function generatePath(rng, w, h) {
        var cl = PARAMS.cellLen;
        var scale = PARAMS.fieldScale;
        var sx = rng() * w;
        var sy = rng() * h;
        var center = chooseSwirlCenter(rng, w, h, sx, sy);
        // Initial direction: field sample + per-seed rotation so direction varies across seeds
        var ang = p.noise(sx * scale, sy * scale) * Math.PI * 2 + fieldAngleOffset;
        if (center) {
            ang = Math.atan2(sy - center.y, sx - center.x) + center.dir * Math.PI / 2;
        }
        var pts = [{x:sx, y:sy}];
        var x=sx, y=sy;
        var maxSteps = PARAMS.pathMode === 'flow' ? 300 : 420;
        maxSteps = Math.min(maxSteps, Math.max(160, Math.round(14000 / Math.max(1, PARAMS.whirlCount))));
        for (var i=0; i<maxSteps; i++) {
            var fieldAng = p.noise(x * scale, y * scale) * Math.PI * 2 + fieldAngleOffset;
            if (center) {
                var dxC = x - center.x;
                var dyC = y - center.y;
                var dist = Math.hypot(dxC, dyC) || 1;
                var orbitAng = Math.atan2(dyC, dxC) + center.dir * Math.PI / 2;
                var targetRadius = center.targetRadius || Math.min(w, h) * 0.24;
                var radialError = Math.max(-1, Math.min(1, (dist - targetRadius) / Math.max(1, targetRadius)));
                var swirlAng = orbitAng + radialError * center.dir * 0.7;
                fieldAng = mixAngles(fieldAng, swirlAng, PARAMS.swirlStrength);
            }
            var diff = normAngleDiff(fieldAng, ang);
            ang += diff * (center ? 0.22 : 0.15);
            x += Math.cos(ang) * cl;
            y += Math.sin(ang) * cl;
            pts.push({x:x, y:y});
            if (x < -120 || x > w+120 || y < -120 || y > h+120) break;
        }
        var pad=80, s=0, e=pts.length-1;
        while (s < e && !inBounds(pts[s],w,h,pad)) s++;
        while (e > s && !inBounds(pts[e],w,h,pad)) e--;
        var out = pts.slice(s, e+1);
        return out.length >= 2 ? out : null;
    }

    function inBounds(pt, w, h, pad) {
        return pt.x > -pad && pt.x < w+pad && pt.y > -pad && pt.y < h+pad;
    }

    function buildWhirl(pathRng, rowsRng, dims, zIndex) {
        var path = generatePath(pathRng, dims.width, dims.height);
        if (!path || path.length < 2) return null;

        var spread = PARAMS.rowsSpread;
        var rows = Math.max(1, Math.round(PARAMS.rowsBase * (1 + (rowsRng()-0.5)*2*spread)));
        var cw = PARAMS.cellWidth;
        var cells = [];

        for (var i=0; i<path.length-1; i++) {
            var n0=normalAt(path,i), n1=normalAt(path,i+1);
            var tangAng = Math.atan2(path[i+1].y-path[i].y, path[i+1].x-path[i].x);
            for (var r=0; r<rows; r++) {
                var io=r*cw, oo=(r+1)*cw;
                cells.push({
                    quad: [
                        {x:path[i].x+n0.x*io,   y:path[i].y+n0.y*io},
                        {x:path[i].x+n0.x*oo,   y:path[i].y+n0.y*oo},
                        {x:path[i+1].x+n1.x*oo, y:path[i+1].y+n1.y*oo},
                        {x:path[i+1].x+n1.x*io, y:path[i+1].y+n1.y*io}
                    ],
                    colorIdx: cellColorIdx(zIndex, i, r),
                    tangAng: tangAng
                });
            }
        }
        if (!cells.length) return null;

        var outline=[];
        for (var i=0; i<path.length; i++) outline.push({x:path[i].x, y:path[i].y});
        for (var i=path.length-1; i>=0; i--) {
            var n=normalAt(path,i);
            outline.push({x:path[i].x+n.x*rows*cw, y:path[i].y+n.y*rows*cw});
        }
        return {cells:cells, outline:outline, zIndex:zIndex};
    }

    function buildAllWhirls() {
        p.noiseSeed(globalSeed);
        // Per-seed angle offset — rotates the entire Perlin field so dominant flow
        // direction changes completely from seed to seed
        fieldAngleOffset = makeRng(globalSeed * 999983 + 7)() * Math.PI * 2;
        var dims = paper.getPaperPixels(PARAMS.paperSize);
        var centerRng = makeRng((globalSeed ^ 0x9e3779b9) >>> 0);
        sharedSwirlCenter = {
            x: dims.width * (0.35 + centerRng() * 0.3),
            y: dims.height * (0.35 + centerRng() * 0.3),
            dir: centerRng() < 0.5 ? -1 : 1,
            targetRadius: Math.min(dims.width, dims.height) * (0.14 + centerRng() * 0.18)
        };
        whirls = [];
        for (var i=0; i<PARAMS.whirlCount; i++) {
            var pathRng = makeRng((globalSeed ^ (i * 2654435761)) >>> 0);
            var rowsRng = makeRng(((globalSeed * 1000003) ^ (i * 2246822519)) >>> 0);
            var w = buildWhirl(pathRng, rowsRng, dims, i);
            if (w) whirls.push(w);
        }
    }

    // ---- hatch (SVG) ----
    function hatchQuad(quad, angleDeg, density) {
        var spacing = (paper.DPI/25.4)/density;
        var ang = angleDeg*Math.PI/180;
        var dir={x:Math.cos(ang), y:Math.sin(ang)}, nrm={x:-Math.sin(ang), y:Math.cos(ang)};
        var proj=function(pt){return nrm.x*pt.x+nrm.y*pt.y;};
        var minP=Infinity, maxP=-Infinity;
        quad.forEach(function(pt){var pr=proj(pt); if(pr<minP)minP=pr; if(pr>maxP)maxP=pr;});
        var lines=[];
        for (var k=Math.floor((minP-spacing)/spacing); k<=Math.ceil((maxP+spacing)/spacing); k++) {
            var off=k*spacing;
            var p0={x:-9999*dir.x+off*nrm.x, y:-9999*dir.y+off*nrm.y};
            var p1={x: 9999*dir.x+off*nrm.x, y: 9999*dir.y+off*nrm.y};
            var ts=[];
            for (var i=0; i<quad.length; i++) {
                var t=segIntersectT(p0,p1,quad[i],quad[(i+1)%quad.length]);
                if (t!==null) ts.push(t);
            }
            ts.sort(function(a,b){return a-b;});
            for (var j=0; j+1<ts.length; j+=2)
                lines.push({x1:p0.x+(p1.x-p0.x)*ts[j], y1:p0.y+(p1.y-p0.y)*ts[j],
                             x2:p0.x+(p1.x-p0.x)*ts[j+1], y2:p0.y+(p1.y-p0.y)*ts[j+1]});
        }
        return lines;
    }

    function noisyLineSegments(lines, spacing, phase, wobble, broken) {
        var out = [];
        lines.forEach(function(ln, i) {
            var dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
            var len = Math.hypot(dx, dy);
            if (len < 1) return;
            var ux = dx / len, uy = dy / len;
            var nx = -uy, ny = ux;
            var pieces = broken ? Math.max(2, Math.min(8, Math.floor(len / Math.max(4, spacing * 2)))) : 1;
            for (var j = 0; j < pieces; j++) {
                var a = pieces === 1 ? 0 : j / pieces;
                var b = pieces === 1 ? 1 : Math.min(1, a + 0.48 + 0.26 * Math.sin(phase + i * 1.9 + j * 2.7));
                var gap = broken ? 0.1 + 0.08 * Math.sin(phase + i * 2.3 + j) : 0.02;
                a = Math.min(0.96, a + gap);
                b = Math.max(a + 0.02, b - gap);
                var o1 = wobble * Math.sin(phase + i * 0.83 + j * 2.1);
                var o2 = wobble * Math.sin(phase + i * 1.17 + j * 2.6 + 1.3);
                out.push({
                    x1: ln.x1 + dx * a + nx * o1,
                    y1: ln.y1 + dy * a + ny * o1,
                    x2: ln.x1 + dx * b + nx * o2,
                    y2: ln.y1 + dy * b + ny * o2
                });
            }
        });
        return out;
    }

    function zigzagQuad(quad, angleDeg, density, phase) {
        var spacing = (paper.DPI/25.4)/density;
        var base = hatchQuad(quad, angleDeg, density / 1.15);
        var out = [];
        base.forEach(function(ln, i) {
            var dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1;
            var len = Math.hypot(dx, dy);
            if (len < 2) return;
            var ux = dx / len, uy = dy / len;
            var nx = -uy, ny = ux;
            var steps = Math.max(2, Math.min(16, Math.floor(len / Math.max(5, spacing * 1.2))));
            var prev = null;
            for (var s = 0; s <= steps; s++) {
                var t = s / steps;
                var side = (s + i) % 2 === 0 ? -1 : 1;
                var off = side * spacing * 0.45 + Math.sin(phase + s * 1.7 + i) * spacing * 0.09;
                var pt = { x: ln.x1 + dx * t + nx * off, y: ln.y1 + dy * t + ny * off };
                if (prev) out.push({ x1: prev.x, y1: prev.y, x2: pt.x, y2: pt.y });
                prev = pt;
            }
        });
        return out;
    }

    function fillLinesForCell(cell) {
        var hatchDeg = cell.tangAng * 180 / Math.PI + 90 + PARAMS.fillAngle;
        var spacing = (paper.DPI / 25.4) / PARAMS.density;
        var phase = (cell.colorIdx % 100000) * 0.001;
        if (PARAMS.fillStyle === 'zigzagHatch') return zigzagQuad(cell.quad, hatchDeg, PARAMS.density, phase);
        var lines = hatchQuad(cell.quad, hatchDeg, PARAMS.density);
        if (PARAMS.fillStyle === 'sketchHatch' || PARAMS.fillStyle === 'streakHatch') {
            var broken = PARAMS.fillStyle === 'streakHatch';
            var wobble = spacing * PARAMS.fillJitter * (broken ? 0.9 : 0.45);
            return noisyLineSegments(lines, spacing, phase, wobble, broken);
        }
        return lines;
    }

    // ---- canvas ----
    p.registerSketchAPI = function(register){ if(typeof register==='function') register(api); };

    p.setup = function() {
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize);
        canvas.parent(document.getElementById('make-sketch'));
        p.pixelDensity(1); p.noLoop();
        globalSeed = Math.floor(Math.random()*1e8)+1;
        buildAllWhirls();
    };

    function getCellColor(cell) {
        var pal = PARAMS.palette.length ? PARAMS.palette : ['#000000'];
        var hex = pal[cell.colorIdx % pal.length];
        var c = p.color(hex);
        if (PARAMS.viewMode === 'multiply') c.setAlpha(204);
        return c;
    }

    function drawCells(whirl, strokeW) {
        whirl.cells.forEach(function(cell) {
            if (PARAMS.fillStyle === 'solid') {
                p.fill(getCellColor(cell));
                if (PARAMS.showBorder) { p.stroke(0); p.strokeWeight(strokeW*1.5); } else p.noStroke();
                p.beginShape();
                cell.quad.forEach(function(pt){ p.vertex(pt.x, pt.y); });
                p.endShape(p.CLOSE);
            } else {
                p.noFill();
                p.stroke(getCellColor(cell));
                p.strokeWeight(strokeW);
                fillLinesForCell(cell).forEach(function(ln) {
                    p.line(ln.x1, ln.y1, ln.x2, ln.y2);
                });
                if (PARAMS.showBorder) {
                    p.stroke(0);
                    p.strokeWeight(strokeW*1.5);
                    p.beginShape();
                    cell.quad.forEach(function(pt){ p.vertex(pt.x, pt.y); });
                    p.endShape(p.CLOSE);
                }
            }
        });
    }

    function drawWhirlMask(whirl) {
        if (!whirl.outline.length) return;
        p.push();
        p.blendMode(p.BLEND);
        p.noStroke();
        p.fill(255);
        p.beginShape();
        whirl.outline.forEach(function(pt){ p.vertex(pt.x, pt.y); });
        p.endShape(p.CLOSE);
        p.pop();
        p.blendMode(PARAMS.viewMode === 'multiply' ? p.MULTIPLY : p.BLEND);
    }

    p.draw = function() {
        p.background(255);
        paper.drawPaperBorder(p);

        var mp = paper.getMarginPixels(PARAMS.margin);
        var ctx = p.drawingContext;
        var strokeW = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));

        if (PARAMS.viewMode === 'multiply') p.blendMode(p.MULTIPLY);

        ctx.save();
        ctx.beginPath();
        ctx.rect(mp, mp, p.width-2*mp, p.height-2*mp);
        ctx.clip();

        whirls.forEach(function(whirl, i) {
            if (PARAMS.overlapMode === 'erase' && i > 0) drawWhirlMask(whirl);
            drawCells(whirl, strokeW);
        });

        ctx.restore();
        p.blendMode(p.BLEND);
    };

    // ---- SVG export ----
    function exportSVG() {
        var dims = paper.getPaperPixels(PARAMS.paperSize);
        var mp = paper.getMarginPixels(PARAMS.margin);
        var sw = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        var ts = new Date().toISOString().replace(/[:.]/g,'-');
        var parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<svg xmlns="http://www.w3.org/2000/svg" width="'+dims.width+'" height="'+dims.height+'" viewBox="0 0 '+dims.width+' '+dims.height+'">',
            '<g>'
        ];
        var useBlendGroup = PARAMS.viewMode === 'multiply' && PARAMS.overlapMode !== 'erase';
        if (useBlendGroup) parts.push('<g style="mix-blend-mode:multiply">');

        whirls.forEach(function(whirl, whirlIndex) {
            var clipOutlines = PARAMS.overlapMode === 'erase'
                ? whirls.slice(whirlIndex + 1).map(function(w){ return w.outline; })
                : whirls.filter(function(w){ return w.zIndex > whirl.zIndex; }).map(function(w){ return w.outline; });

            whirl.cells.forEach(function(cell) {
                var color = getCellColor(cell);
                if (PARAMS.fillStyle === 'solid') {
                    var pts = cell.quad.map(function(pt){return fmt(pt.x)+','+fmt(pt.y);}).join(' ');
                    parts.push('<polygon points="'+pts+'" fill="'+color+'" stroke="none"/>');
                    return;
                }
                fillLinesForCell(cell).forEach(function(ln) {
                    var segs=[{x1:ln.x1,y1:ln.y1,x2:ln.x2,y2:ln.y2}];
                    clipOutlines.forEach(function(outline) {
                        var next=[];
                        segs.forEach(function(seg){ Array.prototype.push.apply(next, clipLineOutsidePoly(seg.x1,seg.y1,seg.x2,seg.y2,outline)); });
                        segs=next;
                    });
                    segs.forEach(function(seg) {
                        parts.push('<line x1="'+fmt(seg.x1)+'" y1="'+fmt(seg.y1)+'" x2="'+fmt(seg.x2)+'" y2="'+fmt(seg.y2)+'" stroke="'+color+'" stroke-width="'+fmt(sw)+'" stroke-linecap="round"/>');
                    });
                });
            });

            if (PARAMS.showBorder) {
                whirl.cells.forEach(function(cell) {
                    var pts=cell.quad.map(function(pt){return fmt(pt.x)+','+fmt(pt.y);}).join(' ');
                    parts.push('<polygon points="'+pts+'" fill="none" stroke="#000000" stroke-width="'+fmt(sw*1.5)+'" stroke-linejoin="round"/>');
                });
            }
        });

        if (useBlendGroup) parts.push('</g>');
        parts.push('</g></svg>');
        dlSvg(parts.join('\n'), '90percentart-whirls-'+ts+'.svg');
    }

    function fmt(n){ return Number(n).toFixed(3); }

    function dlSvg(str, filename) {
        var blob=new Blob([str],{type:'image/svg+xml;charset=utf-8'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');
        a.href=url; a.download=filename; a.style.display='none';
        document.body.appendChild(a); a.click();
        setTimeout(function(){a.remove(); URL.revokeObjectURL(url);},1000);
    }
};
