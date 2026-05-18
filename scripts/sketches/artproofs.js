window.sketches = window.sketches || {};
window.sketches['artproofs'] = function(p) {
    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize: '9x12',
        margin: 1,
        layerWidthMean: 0.3,
        layerWidthSD: 0.15,
        eltsPerLayerMean: 0.4,
        eltsPerLayerSD: 0.2,
        fillFactor: 0.5,
        sliceProb: 0.8,
        fillBlackProb: 0.5,
        wedgeCount: 0.3,
        wedgeThetaSize: 0.3,
        wedgeRadius: 0.5,
        fillStyle: 'arcs',
        compositeMode: 'arcTrim',
        fillAngle: 45,
        fillJitter: 0,
        ringConcentricity: 0,
        arcConcentricity: 0,
        penWidthMm: 0.4,
        viewMode: 'multiply',
        palette: ['#000000', '#e63946']
    };

    var elements = [];
    var globalSeed = 42;
    var canvasW = 0, canvasH = 0;

    function makeRng(seed) {
        var s = (seed >>> 0) || 1;
        return function() { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
    }

    function gaussian(rng, mean, sd) {
        var u = rng(), v = rng();
        var z = Math.sqrt(-2 * Math.log(Math.max(u, 1e-10))) * Math.cos(2 * Math.PI * v);
        return mean + sd * z;
    }

    function betaSample(rng, a, b) {
        a = Math.max(1e-10, Math.min(1e10, a));
        b = Math.max(1e-10, Math.min(1e10, b));
        var mean = a / (a + b);
        var variance = a * b / ((a + b) * (a + b) * (a + b + 1));
        var z = gaussian(rng, 0, 1);
        return Math.max(0, Math.min(1, mean + Math.sqrt(variance) * z));
    }

    function pickColor(rng, palette) {
        return palette[Math.floor(rng() * palette.length)];
    }

    function randomFillStyle(rng) {
        var styles = ['arcs', 'hatch', 'sketchHatch', 'streakHatch', 'zigzagHatch', 'crosshatch', 'waves', 'dots', 'bigDots', 'mixedDots', 'none'];
        return styles[Math.floor(rng() * styles.length)];
    }

    function inkColor(hex) {
        var c = p.color(hex);
        if (PARAMS.viewMode === 'multiply') c.setAlpha(204);
        return c;
    }

    function ptAt(cx, cy, r, theta) {
        return { x: cx + r * Math.cos(-theta), y: cy + r * Math.sin(-theta) };
    }

    function buildElements() {
        var rng     = makeRng(globalSeed);                  // layout + colors
        var fillRng = makeRng(globalSeed ^ 0xDEADBEEF);    // fill texture jitter — isolated so changing
                                                            // fillJitter/fillAngle never shifts colors
        elements = [];
        var marginPx = paper.getMarginPixels(PARAMS.margin);
        var w = canvasW - marginPx * 2;
        var h = canvasH - marginPx * 2;
        if (w <= 0 || h <= 0) return;
        var maxRadius = Math.min(w, h) / 2 - 20;
        var cx = canvasW / 2;
        var cy = canvasH / 2;
        var pal = PARAMS.palette.length ? PARAMS.palette : ['#000000'];

        var v0 = PARAMS.layerWidthMean, v1 = PARAMS.layerWidthSD;
        var v2 = PARAMS.eltsPerLayerMean, v3 = PARAMS.eltsPerLayerSD;
        var v4 = PARAMS.fillFactor;
        var v5 = PARAMS.sliceProb, v6 = PARAMS.fillBlackProb;
        var v7 = PARAMS.wedgeCount, v8 = PARAMS.wedgeThetaSize, v9 = PARAMS.wedgeRadius;
        var jitterFrac = PARAMS.fillJitter / 100;

        var ringCFrac = PARAMS.ringConcentricity / 100;
        var arcCFrac  = PARAMS.arcConcentricity  / 100;

        var currRadius = 20;
        while (currRadius < maxRadius) {
            var layerWidth = Math.abs(gaussian(rng, v0 * maxRadius / 2 + 20, v1 * maxRadius / 5));
            if (layerWidth < 0.5 || currRadius + layerWidth > maxRadius) break;

            var numElts = Math.floor(Math.abs(gaussian(rng, v2 * 30, v3 * 5))) + 1;
            var eltSize = 2 * Math.PI / numElts;

            // Ring-level center offset: generated once, shared by every slice in this ring
            var ringDx = ringCFrac > 0 ? (fillRng() * 2 - 1) * ringCFrac * maxRadius * 0.35 : fillRng() * 0;
            var ringDy = ringCFrac > 0 ? (fillRng() * 2 - 1) * ringCFrac * maxRadius * 0.35 : fillRng() * 0;

            for (var j = 0; j < numElts; j++) {
                if (v5 > rng()) {
                    var peakiness = 1e3 / (1e4 * v6 * v6 + 1e-6);
                    var a = v4 * peakiness, b = peakiness - a;
                    var fillFact = Math.pow(Math.max(0, Math.min(1, betaSample(rng, a, b))), 2);
                    var strokeIdx = Math.floor(rng() * pal.length);
                    var strokeCol = pal[strokeIdx];
                    var fillCol   = pal.length > 1 ? pal[(strokeIdx + 1) % pal.length] : strokeCol;
                    // Per-arc texture jitter (always advances fillRng so changing these params
                    // doesn't shift the concentricity values)
                    var elFillAngle    = PARAMS.fillAngle + (jitterFrac > 0 ? (fillRng() * 2 - 1) * jitterFrac * 60 : fillRng() * 0);
                    var elFillPhase    = fillRng() * Math.PI * 2;
                    var elSpacingScale = 1 + (jitterFrac > 0 ? (fillRng() * 2 - 1) * jitterFrac * 0.4 : fillRng() * 0);
                    // Arc-level additional offset (smaller radius, additive to ring offset)
                    var arcDx = arcCFrac > 0 ? (fillRng() * 2 - 1) * arcCFrac * maxRadius * 0.18 : fillRng() * 0;
                    var arcDy = arcCFrac > 0 ? (fillRng() * 2 - 1) * arcCFrac * maxRadius * 0.18 : fillRng() * 0;
                    elements.push({ type: 'slice', cx: cx + ringDx + arcDx, cy: cy + ringDy + arcDy,
                        t0: j * eltSize, t1: (j + 1) * eltSize,
                        r0: currRadius, r1: currRadius + layerWidth,
                        fillFact: fillFact, color: strokeCol, fillColor: fillCol,
                        fillAngle: elFillAngle, fillPhase: elFillPhase, spacingScale: elSpacingScale,
                        fillStyle: PARAMS.fillStyle === 'random' ? randomFillStyle(fillRng) : PARAMS.fillStyle });
                }
            }
            currRadius += layerWidth + Math.abs(gaussian(rng, v4 * 20, v4 * 4));
        }

        var numWedges = Math.floor(Math.abs(gaussian(rng, v7 * 16, v7 * 2)));
        for (var i = 0; i < numWedges; i++) {
            var thetaSize = rng() * 0.17 + 0.03 + Math.abs(gaussian(rng, v8 * Math.PI / 6, 0.001));
            var startTheta = rng() * 2 * Math.PI - thetaSize / 2;
            var radius = Math.min(maxRadius - 20, Math.max(gaussian(rng, v9 * maxRadius / 1.5, maxRadius / 5), 30));
            var wedgeIdx = Math.floor(rng() * pal.length);
            // Wedges use arc concentricity only (no ring structure)
            var wDx = arcCFrac > 0 ? (fillRng() * 2 - 1) * arcCFrac * maxRadius * 0.25 : fillRng() * 0;
            var wDy = arcCFrac > 0 ? (fillRng() * 2 - 1) * arcCFrac * maxRadius * 0.25 : fillRng() * 0;
            elements.push({ type: 'wedge', cx: cx + wDx, cy: cy + wDy, r: radius,
                t0: startTheta, t1: startTheta + thetaSize,
                color: pal[wedgeIdx] });
        }
        centerElementsOnPage();
    }

    function shouldMaskElement(el) {
        if (PARAMS.compositeMode === 'trim') return true;
        if (PARAMS.compositeMode === 'arcTrim') return el.type === 'slice';
        return false;
    }

    function svgArcPath(cx, cy, r, t0, t1) {
        var p0 = ptAt(cx, cy, r, t0), p1 = ptAt(cx, cy, r, t1);
        var large = (t1 - t0) > Math.PI ? 1 : 0;
        return 'M ' + p0.x.toFixed(2) + ',' + p0.y.toFixed(2) +
               ' A ' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 ' + large + ',0 ' +
               p1.x.toFixed(2) + ',' + p1.y.toFixed(2);
    }

    function drawArc(cx, cy, r, t0, t1) {
        p.arc(cx, cy, r * 2, r * 2, -t1, -t0, p.OPEN);
    }

    function fillLineCount(width, fillFact) {
        var penPx = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        var maxLines = Math.max(1, Math.floor(width / penPx));
        return Math.max(1, Math.round(fillFact * maxLines));
    }

    function fillSpacing(el) {
        var penPx = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        var width = el.r1 - el.r0;
        var numLines = fillLineCount(width, el.fillFact);
        return Math.max(penPx, width / (numLines + 1)) * (el.spacingScale || 1);
    }

    // ---- texture helpers ----

    // Approximate the arc-wedge slice as a closed polygon (n segments per arc)
    function wedgePoly(el, n) {
        var pts = [], i, t;
        for (i = 0; i <= n; i++) {
            t = el.t0 + (el.t1 - el.t0) * i / n;
            pts.push({ x: el.cx + el.r1 * Math.cos(-t), y: el.cy + el.r1 * Math.sin(-t) });
        }
        for (i = n; i >= 0; i--) {
            t = el.t0 + (el.t1 - el.t0) * i / n;
            pts.push({ x: el.cx + el.r0 * Math.cos(-t), y: el.cy + el.r0 * Math.sin(-t) });
        }
        return pts;
    }

    function wedgeElementPoly(el, n) {
        var pts = [{ x: el.cx, y: el.cy }];
        for (var i = 0; i <= n; i++) {
            var t = el.t0 + (el.t1 - el.t0) * i / n;
            pts.push({ x: el.cx + el.r * Math.cos(-t), y: el.cy + el.r * Math.sin(-t) });
        }
        return pts;
    }

    function elementMaskPoly(el) {
        if (el.type === 'slice') return wedgePoly(el, 18);
        if (el.type === 'wedge') return wedgeElementPoly(el, 18);
        return [];
    }

    function elementBounds(el) {
        var poly = elementMaskPoly(el);
        if (!poly.length) return null;
        var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (var i = 0; i < poly.length; i++) {
            b.minX = Math.min(b.minX, poly[i].x);
            b.minY = Math.min(b.minY, poly[i].y);
            b.maxX = Math.max(b.maxX, poly[i].x);
            b.maxY = Math.max(b.maxY, poly[i].y);
        }
        return b;
    }

    function centerElementsOnPage() {
        if (!elements.length) return;
        var bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (var i = 0; i < elements.length; i++) {
            var b = elementBounds(elements[i]);
            if (!b) continue;
            bounds.minX = Math.min(bounds.minX, b.minX);
            bounds.minY = Math.min(bounds.minY, b.minY);
            bounds.maxX = Math.max(bounds.maxX, b.maxX);
            bounds.maxY = Math.max(bounds.maxY, b.maxY);
        }
        if (!isFinite(bounds.minX)) return;
        var marginPx = paper.getMarginPixels(PARAMS.margin);
        var targetX = marginPx + (canvasW - marginPx * 2) / 2;
        var targetY = marginPx + (canvasH - marginPx * 2) / 2;
        var dx = targetX - (bounds.minX + bounds.maxX) / 2;
        var dy = targetY - (bounds.minY + bounds.maxY) / 2;
        for (var j = 0; j < elements.length; j++) {
            elements[j].cx += dx;
            elements[j].cy += dy;
        }
    }

    // Parameter t along hatch line where it crosses polygon edge (ex,ey)-(fx,fy); null if no crossing
    function lineEdgeT(ax, ay, dx, dy, ex, ey, fx, fy) {
        var gx = fx - ex, gy = fy - ey;
        var denom = dx * gy - dy * gx;
        if (Math.abs(denom) < 1e-10) return null;
        var t = ((ex - ax) * gy - (ey - ay) * gx) / denom;
        var s = ((ex - ax) * dy - (ey - ay) * dx) / denom;
        return (s >= -1e-6 && s <= 1 + 1e-6) ? t : null;
    }

    function polyInside(pt, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
            if (((yi > pt.y) !== (yj > pt.y)) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
                inside = !inside;
        }
        return inside;
    }

    // Clip parallel hatch lines to a polygon; returns [{x1,y1,x2,y2}]
    function hatchSegs(poly, angleDeg, spacing) {
        var ang = angleDeg * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var nx = -dy, ny = dx;
        var pMin = Infinity, pMax = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            var proj = poly[i].x * nx + poly[i].y * ny;
            pMin = Math.min(pMin, proj); pMax = Math.max(pMax, proj);
        }
        var segs = [];
        for (var k = Math.floor(pMin / spacing); k * spacing <= pMax; k++) {
            var p0val = k * spacing;
            var ax = p0val * nx, ay = p0val * ny;
            var ts = [];
            for (var e = 0; e < poly.length; e++) {
                var ex = poly[e].x, ey = poly[e].y;
                var fx = poly[(e + 1) % poly.length].x, fy = poly[(e + 1) % poly.length].y;
                var tval = lineEdgeT(ax, ay, dx, dy, ex, ey, fx, fy);
                if (tval !== null) ts.push(tval);
            }
            ts.sort(function(a, b) { return a - b; });
            for (var m = 0; m + 1 < ts.length; m += 2) {
                var t0 = ts[m], t1 = ts[m + 1];
                var mx = ax + (t0 + t1) / 2 * dx, my = ay + (t0 + t1) / 2 * dy;
                if (polyInside({ x: mx, y: my }, poly))
                    segs.push({ x1: ax + t0 * dx, y1: ay + t0 * dy, x2: ax + t1 * dx, y2: ay + t1 * dy });
            }
        }
        return segs;
    }

    // Wavy hatch: raster approach — dense point sampling, keep runs inside the polygon
    function waveSegs(poly, angleDeg, spacing, phase) {
        spacing = Math.max(spacing, paper.mmToPixels(PARAMS.penWidthMm) * 2.5, 4);
        var ang = angleDeg * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var nx = -dy, ny = dx;
        var pMin = Infinity, pMax = -Infinity, tMin = Infinity, tMax = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            var pv = poly[i].x * nx + poly[i].y * ny;
            var tv = poly[i].x * dx + poly[i].y * dy;
            pMin = Math.min(pMin, pv); pMax = Math.max(pMax, pv);
            tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv);
        }
        var amplitude = spacing * 0.55;
        var frequency  = 2 * Math.PI / (spacing * 3.5);
        var segs = [];
        for (var k = Math.floor(pMin / spacing); k * spacing <= pMax; k++) {
            var p0val = k * spacing;
            var run = [];
            var samples = Math.max(16, Math.min(96, Math.ceil((tMax - tMin) / (spacing * 0.45))));
            for (var s = 0; s <= samples; s++) {
                var tv2 = tMin + (tMax - tMin) * s / samples;
                var waveOff = amplitude * Math.sin(frequency * tv2 + phase + k * 1.3);
                var px = (p0val + waveOff) * nx + tv2 * dx;
                var py = (p0val + waveOff) * ny + tv2 * dy;
                if (polyInside({ x: px, y: py }, poly)) {
                    run.push({ x: px, y: py });
                } else {
                    for (var r = 0; r + 1 < run.length; r++)
                        segs.push({ x1: run[r].x, y1: run[r].y, x2: run[r+1].x, y2: run[r+1].y });
                    run = [];
                }
            }
            for (var r2 = 0; r2 + 1 < run.length; r2++)
                segs.push({ x1: run[r2].x, y1: run[r2].y, x2: run[r2+1].x, y2: run[r2+1].y });
        }
        return segs;
    }

    function noisyHatchSegs(poly, angleDeg, spacing, phase, wobble, broken) {
        var base = hatchSegs(poly, angleDeg, spacing);
        var segs = [];
        for (var i = 0; i < base.length; i++) {
            var s = base[i];
            var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;
            var ux = dx / len, uy = dy / len;
            var nx = -uy, ny = ux;
            var pieces = broken ? Math.max(2, Math.min(7, Math.floor(len / (spacing * 2.4)))) : 1;
            for (var j = 0; j < pieces; j++) {
                var a = pieces === 1 ? 0 : j / pieces;
                var b = pieces === 1 ? 1 : Math.min(1, a + 0.55 + 0.22 * Math.sin(phase + i * 1.7 + j));
                var gap = broken ? 0.12 + 0.08 * Math.sin(phase + i * 2.1 + j * 3.3) : 0.02;
                a = Math.min(0.96, a + gap);
                b = Math.max(a + 0.02, b - gap);
                var o1 = wobble * Math.sin(phase + i * 0.91 + j * 2.4);
                var o2 = wobble * Math.sin(phase + i * 1.23 + j * 2.9 + 1.7);
                segs.push({
                    x1: s.x1 + dx * a + nx * o1,
                    y1: s.y1 + dy * a + ny * o1,
                    x2: s.x1 + dx * b + nx * o2,
                    y2: s.y1 + dy * b + ny * o2
                });
            }
        }
        return segs;
    }

    function zigzagSegs(poly, angleDeg, spacing, phase) {
        var ang = angleDeg * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var nx = -dy, ny = dx;
        var pMin = Infinity, pMax = -Infinity, tMin = Infinity, tMax = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            var pv = poly[i].x * nx + poly[i].y * ny;
            var tv = poly[i].x * dx + poly[i].y * dy;
            pMin = Math.min(pMin, pv); pMax = Math.max(pMax, pv);
            tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv);
        }
        var segs = [];
        var zig = Math.max(spacing * 1.4, 7);
        var amp = spacing * 0.52;
        for (var k = Math.floor(pMin / spacing); k * spacing <= pMax; k++) {
            var p0val = k * spacing;
            var pts = [];
            var steps = Math.max(8, Math.min(80, Math.ceil((tMax - tMin) / zig)));
            for (var s = 0; s <= steps; s++) {
                var tv2 = tMin + (tMax - tMin) * s / steps;
                var side = ((s + k) % 2 === 0 ? -1 : 1);
                var off = side * amp + Math.sin(phase + s * 1.7 + k) * amp * 0.16;
                pts.push({ x: (p0val + off) * nx + tv2 * dx, y: (p0val + off) * ny + tv2 * dy });
            }
            for (var j = 0; j + 1 < pts.length; j++) {
                var mid = { x: (pts[j].x + pts[j + 1].x) / 2, y: (pts[j].y + pts[j + 1].y) / 2 };
                if (polyInside(mid, poly)) segs.push({ x1: pts[j].x, y1: pts[j].y, x2: pts[j + 1].x, y2: pts[j + 1].y });
            }
        }
        return segs;
    }

    // Grid of dot centres inside the polygon
    function dotPoints(poly, spacing, phase, sizeMode) {
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (var i = 0; i < poly.length; i++) {
            minX = Math.min(minX, poly[i].x); maxX = Math.max(maxX, poly[i].x);
            minY = Math.min(minY, poly[i].y); maxY = Math.max(maxY, poly[i].y);
        }
        var pts = [];
        for (var y = Math.floor(minY / spacing) * spacing; y <= maxY; y += spacing)
            for (var x = Math.floor(minX / spacing) * spacing; x <= maxX; x += spacing) {
                var jx = Math.sin(x * 0.027 + y * 0.019 + phase) * spacing * 0.12;
                var jy = Math.cos(x * 0.017 - y * 0.031 + phase) * spacing * 0.12;
                var pt = { x: x + jx, y: y + jy };
                if (polyInside(pt, poly)) {
                    var tone = 0.5 + 0.5 * Math.sin(x * 0.041 + y * 0.037 + phase);
                    var radiusScale = sizeMode === 'mixed' ? 0.12 + tone * 0.42 : (sizeMode === 'big' ? 0.46 : 0.22);
                    pts.push({ x: pt.x, y: pt.y, radiusScale: radiusScale });
                }
            }
        return pts;
    }

    // Dispatch texture fill for canvas draw
    function drawFill(el) {
        if (el.fillFact <= 0) return;
        var style = el.fillStyle || PARAMS.fillStyle;
        if (style === 'random') style = 'arcs';
        var sp = fillSpacing(el);
        p.stroke(inkColor(el.fillColor || el.color));

        if (style === 'arcs' || !style) {
            var width = el.r1 - el.r0;
            var numLines = fillLineCount(width, el.fillFact);
            var lineSpacing = width / (numLines + 1);
            for (var i = 0; i < numLines; i++)
                drawArc(el.cx, el.cy, el.r0 + lineSpacing * (i + 1), el.t0, el.t1);
            return;
        }
        if (style === 'none') return;

        var poly = wedgePoly(el, 14);
        if (style === 'hatch' || style === 'crosshatch') {
            var segs = hatchSegs(poly, el.fillAngle, sp);
            if (style === 'crosshatch') segs = segs.concat(hatchSegs(poly, el.fillAngle + 90, sp));
            for (var j = 0; j < segs.length; j++) p.line(segs[j].x1, segs[j].y1, segs[j].x2, segs[j].y2);
        } else if (style === 'sketchHatch' || style === 'streakHatch') {
            var wobble = style === 'streakHatch' ? sp * 0.38 : sp * 0.18;
            var broken = style === 'streakHatch';
            var hs = noisyHatchSegs(poly, el.fillAngle, sp, el.fillPhase || 0, wobble, broken);
            for (var h = 0; h < hs.length; h++) p.line(hs[h].x1, hs[h].y1, hs[h].x2, hs[h].y2);
        } else if (style === 'zigzagHatch') {
            var zs = zigzagSegs(poly, el.fillAngle, sp * 1.2, el.fillPhase || 0);
            for (var z = 0; z < zs.length; z++) p.line(zs[z].x1, zs[z].y1, zs[z].x2, zs[z].y2);
        } else if (style === 'waves') {
            var ws = waveSegs(poly, el.fillAngle, sp, el.fillPhase || 0);
            for (var k = 0; k < ws.length; k++) p.line(ws[k].x1, ws[k].y1, ws[k].x2, ws[k].y2);
        } else if (style === 'dots' || style === 'bigDots' || style === 'mixedDots') {
            var sizeMode = style === 'mixedDots' ? 'mixed' : (style === 'bigDots' ? 'big' : 'normal');
            var dotSpacing = style === 'bigDots' ? sp * 1.65 : sp;
            var dpts = dotPoints(poly, dotSpacing, el.fillPhase || 0, sizeMode);
            p.noStroke(); p.fill(inkColor(el.fillColor || el.color));
            for (var d = 0; d < dpts.length; d++) p.circle(dpts[d].x, dpts[d].y, dotSpacing * dpts[d].radiusScale * 2);
            p.noFill();
        }
    }

    // Dispatch texture fill for SVG export
    function fillToSVG(el, fc, swStr) {
        if (el.fillFact <= 0) return [];
        var style = el.fillStyle || PARAMS.fillStyle;
        if (style === 'random') style = 'arcs';
        var sp = fillSpacing(el);
        var lines = [];

        if (style === 'arcs' || !style) {
            var width = el.r1 - el.r0;
            var numLines = fillLineCount(width, el.fillFact);
            var lineSpacing = width / (numLines + 1);
            for (var i = 0; i < numLines; i++)
                lines.push('<path d="' + svgArcPath(el.cx, el.cy, el.r0 + lineSpacing * (i + 1), el.t0, el.t1) + '" fill="none" stroke="' + fc + '" stroke-width="' + swStr + '"/>');
            return lines;
        }
        if (style === 'none') return [];

        var poly = wedgePoly(el, 14);
        var segs = [];
        if (style === 'hatch' || style === 'crosshatch') {
            segs = hatchSegs(poly, el.fillAngle, sp);
            if (style === 'crosshatch') segs = segs.concat(hatchSegs(poly, el.fillAngle + 90, sp));
        } else if (style === 'sketchHatch' || style === 'streakHatch') {
            segs = noisyHatchSegs(poly, el.fillAngle, sp, el.fillPhase || 0, style === 'streakHatch' ? sp * 0.38 : sp * 0.18, style === 'streakHatch');
        } else if (style === 'zigzagHatch') {
            segs = zigzagSegs(poly, el.fillAngle, sp * 1.2, el.fillPhase || 0);
        } else if (style === 'waves') {
            segs = waveSegs(poly, el.fillAngle, sp, el.fillPhase || 0);
        } else if (style === 'dots' || style === 'bigDots' || style === 'mixedDots') {
            var sizeMode = style === 'mixedDots' ? 'mixed' : (style === 'bigDots' ? 'big' : 'normal');
            var dotSpacing = style === 'bigDots' ? sp * 1.65 : sp;
            dotPoints(poly, dotSpacing, el.fillPhase || 0, sizeMode).forEach(function(pt) {
                var dotR = dotSpacing * pt.radiusScale;
                lines.push('<circle cx="' + pt.x.toFixed(2) + '" cy="' + pt.y.toFixed(2) + '" r="' + dotR.toFixed(2) + '" fill="' + fc + '" stroke="none"/>');
            });
            return lines;
        }
        for (var j = 0; j < segs.length; j++)
            lines.push('<line x1="' + segs[j].x1.toFixed(2) + '" y1="' + segs[j].y1.toFixed(2) + '" x2="' + segs[j].x2.toFixed(2) + '" y2="' + segs[j].y2.toFixed(2) + '" stroke="' + fc + '" stroke-width="' + swStr + '" stroke-linecap="round"/>');
        return lines;
    }

    function drawSlice(el) {
        var p0 = ptAt(el.cx, el.cy, el.r0, el.t0), p1 = ptAt(el.cx, el.cy, el.r1, el.t0);
        var p2 = ptAt(el.cx, el.cy, el.r0, el.t1), p3 = ptAt(el.cx, el.cy, el.r1, el.t1);
        // Stroke: arc outlines in el.color
        p.stroke(inkColor(el.color));
        p.noFill();
        drawArc(el.cx, el.cy, el.r0, el.t0, el.t1);
        drawArc(el.cx, el.cy, el.r1, el.t0, el.t1);
        p.line(p0.x, p0.y, p1.x, p1.y);
        p.line(p2.x, p2.y, p3.x, p3.y);
        // Fill: texture in el.fillColor (may be same as el.color if palette has 1 entry)
        drawFill(el);
        p.noFill();
    }

    function drawElementMask(el) {
        var poly = elementMaskPoly(el);
        if (!poly.length) return;
        p.push();
        p.blendMode(p.BLEND);
        p.noStroke();
        p.fill(255);
        p.beginShape();
        for (var i = 0; i < poly.length; i++) p.vertex(poly[i].x, poly[i].y);
        p.endShape(p.CLOSE);
        p.pop();
        p.blendMode(PARAMS.viewMode === 'multiply' ? p.MULTIPLY : p.BLEND);
    }

    function drawWedge(el) {
        var p0 = ptAt(el.cx, el.cy, el.r, el.t0), p1 = ptAt(el.cx, el.cy, el.r, el.t1);
        p.stroke(inkColor(el.color));
        p.noFill();
        drawArc(el.cx, el.cy, el.r, el.t0, el.t1);
        p.line(el.cx, el.cy, p0.x, p0.y);
        p.line(el.cx, el.cy, p1.x, p1.y);
    }

    function sliceToSVG(el, sw) {
        var p0 = ptAt(el.cx, el.cy, el.r0, el.t0), p1 = ptAt(el.cx, el.cy, el.r1, el.t0);
        var p2 = ptAt(el.cx, el.cy, el.r0, el.t1), p3 = ptAt(el.cx, el.cy, el.r1, el.t1);
        var sc = el.color, fc = el.fillColor || el.color, swStr = sw.toFixed(2);
        // Stroke outlines in sc
        var lines = [
            '<path d="' + svgArcPath(el.cx, el.cy, el.r0, el.t0, el.t1) + '" fill="none" stroke="' + sc + '" stroke-width="' + swStr + '"/>',
            '<path d="' + svgArcPath(el.cx, el.cy, el.r1, el.t0, el.t1) + '" fill="none" stroke="' + sc + '" stroke-width="' + swStr + '"/>',
            '<line x1="' + p0.x.toFixed(2) + '" y1="' + p0.y.toFixed(2) + '" x2="' + p1.x.toFixed(2) + '" y2="' + p1.y.toFixed(2) + '" stroke="' + sc + '" stroke-width="' + swStr + '"/>',
            '<line x1="' + p2.x.toFixed(2) + '" y1="' + p2.y.toFixed(2) + '" x2="' + p3.x.toFixed(2) + '" y2="' + p3.y.toFixed(2) + '" stroke="' + sc + '" stroke-width="' + swStr + '"/>'
        ];
        // Fill texture in fc
        var fillLines = fillToSVG(el, fc, swStr);
        return lines.concat(fillLines).join('\n');
    }

    function maskToSVG(el) {
        var poly = elementMaskPoly(el);
        if (!poly.length) return '';
        return '<polygon points="' + poly.map(function(pt) {
            return pt.x.toFixed(2) + ',' + pt.y.toFixed(2);
        }).join(' ') + '" fill="white" stroke="none"/>';
    }

    function wedgeToSVG(el, sw) {
        var p0 = ptAt(el.cx, el.cy, el.r, el.t0), p1 = ptAt(el.cx, el.cy, el.r, el.t1);
        var c = el.color, swStr = sw.toFixed(2);
        return [
            '<path d="' + svgArcPath(el.cx, el.cy, el.r, el.t0, el.t1) + '" fill="none" stroke="' + c + '" stroke-width="' + swStr + '"/>',
            '<line x1="' + el.cx.toFixed(2) + '" y1="' + el.cy.toFixed(2) + '" x2="' + p0.x.toFixed(2) + '" y2="' + p0.y.toFixed(2) + '" stroke="' + c + '" stroke-width="' + swStr + '"/>',
            '<line x1="' + el.cx.toFixed(2) + '" y1="' + el.cy.toFixed(2) + '" x2="' + p1.x.toFixed(2) + '" y2="' + p1.y.toFixed(2) + '" stroke="' + c + '" stroke-width="' + swStr + '"/>'
        ].join('\n');
    }

    function exportSVG() {
        var sw = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));
        var marginPx = paper.getMarginPixels(PARAMS.margin);
        var svgParts = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvasW + '" height="' + canvasH + '">',
            '<rect x="0" y="0" width="' + canvasW + '" height="' + canvasH + '" fill="white"/>',
            '<defs><clipPath id="mc"><rect x="' + marginPx + '" y="' + marginPx + '" width="' + (canvasW - marginPx * 2) + '" height="' + (canvasH - marginPx * 2) + '"/></clipPath></defs>',
            '<g clip-path="url(#mc)">'
        ];
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (i > 0 && shouldMaskElement(el)) svgParts.push(maskToSVG(el));
            if (el.type === 'slice') svgParts.push(sliceToSVG(el, sw));
            else if (el.type === 'wedge') svgParts.push(wedgeToSVG(el, sw));
        }
        svgParts.push('</g></svg>');
        var blob = new Blob([svgParts.join('\n')], { type: 'image/svg+xml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'artproofs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
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
                { value: 'custom',  label: 'Custom' }
              ]},
            { id: 'compositeMode', label: 'Compositing', type: 'select', value: 'arcTrim',
              options: [
                { value: 'xray', label: 'Xray' },
                { value: 'arcTrim', label: 'Arcs trim, wedges xray' },
                { value: 'trim', label: 'Trim all' }
              ] },
            { id: 'layerWidthMean',   label: 'Layer width',       type: 'range', min: 1, max: 100, step: 1, value: 30, group: 'arcs',
              _toInternal: function(v){ return v/100; } },
            { id: 'layerWidthSD',     label: 'Width variation',   type: 'range', min: 0, max: 100, step: 1, value: 15, group: 'arcs',
              _toInternal: function(v){ return v/100; } },
            { id: 'eltsPerLayerMean', label: 'Segments per ring', type: 'range', min: 1, max: 100, step: 1, value: 40, group: 'arcs',
              _toInternal: function(v){ return v/100; } },
            { id: 'eltsPerLayerSD',   label: 'Segment variation', type: 'range', min: 0, max: 100, step: 1, value: 20, group: 'arcs',
              _toInternal: function(v){ return v/100; } },
            { id: 'fillFactor',       label: 'Fill density',      type: 'range', min: 0, max: 100, step: 1, value: 50, group: 'textures',
              _toInternal: function(v){ return v/100; } },
            { id: 'sliceProb',        label: 'Slice probability', type: 'range', min: 0, max: 100, step: 1, value: 80, group: 'arcs',
              _toInternal: function(v){ return v/100; } },
            { id: 'fillBlackProb',    label: 'Fill concentration',type: 'range', min: 0, max: 100, step: 1, value: 50, group: 'textures',
              _toInternal: function(v){ return v/100; } },
            { id: 'wedgeCount',       label: 'Wedge amount',      type: 'range', min: 0, max: 100, step: 1, value: 30, group: 'wedges',
              _toInternal: function(v){ return v/100; } },
            { id: 'wedgeThetaSize',   label: 'Wedge width',       type: 'range', min: 0, max: 100, step: 1, value: 30, group: 'wedges',
              _toInternal: function(v){ return v/100; } },
            { id: 'wedgeRadius',      label: 'Wedge reach',       type: 'range', min: 0, max: 100, step: 1, value: 50, group: 'wedges',
              _toInternal: function(v){ return v/100; } },
            { id: 'ringConcentricity', label: 'Ring concentricity', type: 'range', min: 0, max: 100, step: 1, value: 0, group: 'arcs' },
            { id: 'arcConcentricity',  label: 'Arc concentricity',  type: 'range', min: 0, max: 100, step: 1, value: 0, group: 'arcs' },
            { id: 'fillStyle', label: 'Fill texture', type: 'select', value: 'arcs', group: 'textures',
              options: [
                { value: 'random',     label: 'Random' },
                { value: 'arcs',       label: 'Arcs (default)' },
                { value: 'hatch',      label: 'Hatch' },
                { value: 'sketchHatch', label: 'Sketch hatch' },
                { value: 'streakHatch', label: 'Streak hatch' },
                { value: 'zigzagHatch', label: 'Zigzag hatch' },
                { value: 'crosshatch', label: 'Crosshatch' },
                { value: 'waves',      label: 'Waves' },
                { value: 'dots',       label: 'Dots' },
                { value: 'bigDots',    label: 'Big dots' },
                { value: 'mixedDots',  label: 'Mixed dots' },
                { value: 'none',       label: 'None' }
              ]},
            { id: 'fillAngle', label: 'Fill angle°', type: 'range', min: 0, max: 180, step: 1, value: 45, group: 'textures',
              visibleWhen: { param: 'fillStyle', values: ['hatch', 'sketchHatch', 'streakHatch', 'zigzagHatch', 'crosshatch', 'waves', 'random'] } },
            { id: 'fillJitter', label: 'Fill jitter', type: 'range', min: 0, max: 100, step: 1, value: 0, group: 'textures' },
            { id: 'penWidthMm', label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: 0.4 },
            { id: 'viewMode',   label: 'View mode', type: 'select', value: 'multiply',
              options: [{ value: 'normal', label: 'Normal' }, { value: 'multiply', label: 'Multiply' }] }
        ]),
        regenerate: function() { resizeIfNeeded(); buildElements(); try { p.redraw(); } catch(e) {} },
        reseed: function() { globalSeed = Math.floor(Math.random() * 1e8) + 1; buildElements(); try { p.redraw(); } catch(e) {} },
        getRecipe: function() {
            return { state: { globalSeed: globalSeed } };
        },
        applyRecipeState: function(state) {
            if (state && Number.isFinite(Number(state.globalSeed))) {
                globalSeed = Number(state.globalSeed);
                buildElements();
                try { p.redraw(); } catch(e) {}
            }
        },
        togglePause: function() { return false; },
        setParam: function(name, rawVal) {
            var pdef = api.params.find(function(x) { return x.id === name; });
            if (pdef) pdef.value = rawVal;
            var val = (pdef && pdef._toInternal) ? pdef._toInternal(Number(rawVal)) : rawVal;
            if (name === 'paperSize')         { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin')            PARAMS.margin = Number(val);
            if (name === 'layerWidthMean')    PARAMS.layerWidthMean = val;
            if (name === 'layerWidthSD')      PARAMS.layerWidthSD = val;
            if (name === 'eltsPerLayerMean')  PARAMS.eltsPerLayerMean = val;
            if (name === 'eltsPerLayerSD')    PARAMS.eltsPerLayerSD = val;
            if (name === 'fillFactor')        PARAMS.fillFactor = val;
            if (name === 'sliceProb')         PARAMS.sliceProb = val;
            if (name === 'fillBlackProb')     PARAMS.fillBlackProb = val;
            if (name === 'wedgeCount')        PARAMS.wedgeCount = val;
            if (name === 'wedgeThetaSize')    PARAMS.wedgeThetaSize = val;
            if (name === 'wedgeRadius')       PARAMS.wedgeRadius = val;
            if (name === 'ringConcentricity') PARAMS.ringConcentricity = Number(rawVal);
            if (name === 'arcConcentricity')  PARAMS.arcConcentricity  = Number(rawVal);
            if (name === 'fillStyle')         PARAMS.fillStyle = val;
            if (name === 'compositeMode')     PARAMS.compositeMode = val;
            if (name === 'fillAngle')         PARAMS.fillAngle = Number(rawVal);
            if (name === 'fillJitter')        PARAMS.fillJitter = Number(rawVal);
            if (name === 'penWidthMm')        PARAMS.penWidthMm = Number(rawVal);
            if (name === 'viewMode')          PARAMS.viewMode = val;
            if (name === 'palette')           PARAMS.palette = Array.isArray(val) && val.length ? val : PARAMS.palette;
            buildElements();
        },
        saveSVG: function() { exportSVG(); }
    };

    function resizeIfNeeded() {
        paper.resizeCanvasToPaper(p, PARAMS.paperSize);
        canvasW = p.width;
        canvasH = p.height;
    }

    p.registerSketchAPI = function(register) { if (typeof register === 'function') register(api); };

    p.setup = function() {
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize);
        canvas.parent(document.getElementById('make-sketch'));
        canvasW = p.width;
        canvasH = p.height;
        p.noLoop();
        buildElements();
    };

    p.draw = function() {
        p.blendMode(p.BLEND);       // must reset BEFORE background() — multiply(white,x)=x so canvas never clears otherwise
        p.background(255);
        p.blendMode(PARAMS.viewMode === 'multiply' ? p.MULTIPLY : p.BLEND);
        paper.drawPaperBorder(p);
        p.strokeWeight(Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm)));
        p.noFill();
        var marginPx = paper.getMarginPixels(PARAMS.margin);
        var ctx = p.drawingContext;
        ctx.save();
        ctx.beginPath();
        ctx.rect(marginPx, marginPx, canvasW - marginPx * 2, canvasH - marginPx * 2);
        ctx.clip();
        for (var i = 0; i < elements.length; i++) {
            var elt = elements[i];
            if (i > 0 && shouldMaskElement(elt)) drawElementMask(elt);
            if (elt.type === 'slice') drawSlice(elt);
            else if (elt.type === 'wedge') drawWedge(elt);
        }
        ctx.restore();
        p.blendMode(p.BLEND);       // reset so next background() call works
    };
};
