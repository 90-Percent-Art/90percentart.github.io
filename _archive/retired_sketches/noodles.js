window.sketches = window.sketches || {};
window.sketches['noodles'] = function(p) {
    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize: '8.5x11',
        margin: 1,
        noodleCount: 8,
        cellLen: 40,
        cellWidth: 22,
        rowsBase: 3,
        rowsSpread: 0.5,
        fieldScale: 0.003,    // Perlin noise scale — lower = smoother/larger field features
        density: 2.0,
        showBorder: true,
        overlapMode: 'layer',
        viewMode: 'normal',
        penWidthMm: 0.4,
        palette: ['#e63946', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#ffd600']
    };

    var noodles = [];
    var globalSeed = 1;

    function makeRng(seed) {
        var s = (seed >>> 0) || 1;
        return function() { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
    }

    // Stable color index: hash of noodle/seg/row + seed. Never uses sequential RNG,
    // so changing row count or curvature doesn't scramble other cells' colors.
    function cellColorIdx(noodleIdx, segIdx, rowIdx) {
        return Math.abs(
            ((globalSeed | 0) * 73856093) ^
            ((noodleIdx + 1) * 19349663) ^
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
            { id: 'noodleCount', label: 'Noodles',    type: 'range', min: 2,   max: 20,  step: 1,   value: 8 },
            { id: 'cellLen',     label: 'Cell length', type: 'range', min: 10,  max: 120, step: 2,   value: 40 },
            { id: 'cellWidth',   label: 'Lane width',  type: 'range', min: 6,   max: 80,  step: 2,   value: 22 },
            { id: 'rowsBase',    label: 'Rows',         type: 'range', min: 1,   max: 10,  step: 1,   value: 3 },
            { id: 'rowsSpread',  label: 'Rows spread', type: 'range', min: 0,   max: 10,  step: 1,   value: 5,
              _toInternal: function(v) { return v / 10; } },
            { id: 'fieldScale',  label: 'Turbulence',  type: 'range', min: 1,   max: 12,  step: 1,   value: 3,
              _toInternal: function(v) { return v / 1000; } },
            { id: 'overlapMode', label: 'Overlap',     type: 'select', value: 'layer',
              options: [{ value: 'layer', label: 'Layer' }, { value: 'erase', label: 'Erase' }] },
            { id: 'density',     label: 'Hatch density',type: 'range', min: 5,   max: 50,  step: 1,   value: 20,
              _toInternal: function(v) { return v / 10; } },
            { id: 'showBorder',  label: 'Cell border', type: 'select', value: 'on',
              options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
            { id: 'penWidthMm',  label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: 0.4 },
            { id: 'viewMode',    label: 'View mode',   type: 'select', value: 'normal',
              options: [{ value: 'normal', label: 'Normal' }, { value: 'multiply', label: 'Multiply' }] }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        reseed: function() { globalSeed = Math.floor(Math.random() * 1e8) + 1; buildAllNoodles(); p.redraw(); },
        setParam: function(name, rawVal) {
            var pdef = api.params.find(function(x) { return x.id === name; });
            if (pdef) pdef.value = rawVal;
            var val = (pdef && pdef._toInternal) ? pdef._toInternal(rawVal) : rawVal;
            if (name === 'paperSize')   { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin')      PARAMS.margin = Number(val);
            if (name === 'noodleCount') PARAMS.noodleCount = Number(val);
            if (name === 'cellLen')     PARAMS.cellLen = Number(val);
            if (name === 'cellWidth')   PARAMS.cellWidth = Number(val);
            if (name === 'rowsBase')    PARAMS.rowsBase = Number(val);
            if (name === 'rowsSpread')  PARAMS.rowsSpread = val;
            if (name === 'fieldScale')  PARAMS.fieldScale = val;
            if (name === 'density')     PARAMS.density = val;
            if (name === 'showBorder')  PARAMS.showBorder = val === 'on';
            if (name === 'overlapMode') PARAMS.overlapMode = val;
            if (name === 'penWidthMm')  PARAMS.penWidthMm = Number(val);
            if (name === 'viewMode')    PARAMS.viewMode = val;
            if (name === 'palette')     { PARAMS.palette = Array.isArray(val) && val.length ? val : PARAMS.palette; }
            // Geometry rebuilds — colors stay stable because cellColorIdx is seed+position based, not sequential RNG
            var rebuilds = ['noodleCount','cellLen','cellWidth','rowsBase','rowsSpread','fieldScale','paperSize','margin'];
            if (rebuilds.indexOf(name) !== -1) buildAllNoodles();
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

    // Returns portions of segment outside poly
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

    function generatePath(rng, w, h) {
        var cl = PARAMS.cellLen;
        var scale = PARAMS.fieldScale;
        // Paths can start anywhere on the page (including near edges)
        var sx = rng() * w;
        var sy = rng() * h;
        // Initial direction from Perlin field at start — gives coherent flow from the start
        var ang = p.noise(sx * scale, sy * scale) * Math.PI * 2;
        var pts = [{x:sx, y:sy}];
        var x=sx, y=sy;
        for (var i=0; i<300; i++) {
            // Sample field at current position
            var fieldAng = p.noise(x * scale, y * scale) * Math.PI * 2;
            // Steer gradually toward field direction (limited turn rate prevents loops)
            var diff = fieldAng - ang;
            // Normalize diff to [-π, π]
            diff = diff - Math.PI * 2 * Math.floor((diff + Math.PI) / (Math.PI * 2));
            ang += diff * 0.15;
            x += Math.cos(ang) * cl;
            y += Math.sin(ang) * cl;
            pts.push({x:x, y:y});
            if (x < -120 || x > w+120 || y < -120 || y > h+120) break;
        }
        var pad=80;
        var s=0, e=pts.length-1;
        while (s < e && !inBounds(pts[s],w,h,pad)) s++;
        while (e > s && !inBounds(pts[e],w,h,pad)) e--;
        var out = pts.slice(s, e+1);
        return out.length >= 2 ? out : null;
    }

    function inBounds(pt, w, h, pad) {
        return pt.x > -pad && pt.x < w+pad && pt.y > -pad && pt.y < h+pad;
    }

    function buildNoodle(pathRng, rowsRng, dims, zIndex) {
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

        // Outline: inner edge forward + outer edge reversed = closed polygon
        var outline=[];
        for (var i=0; i<path.length; i++) outline.push({x:path[i].x, y:path[i].y});
        for (var i=path.length-1; i>=0; i--) {
            var n=normalAt(path,i);
            outline.push({x:path[i].x+n.x*rows*cw, y:path[i].y+n.y*rows*cw});
        }
        return {cells:cells, outline:outline, zIndex:zIndex};
    }

    function buildAllNoodles() {
        p.noiseSeed(globalSeed); // same Perlin field for all paths in this seed
        var dims = paper.getPaperPixels(PARAMS.paperSize);
        noodles = [];
        for (var i=0; i<PARAMS.noodleCount; i++) {
            // Independent RNG streams per noodle — changing curvature/rows won't cascade into neighbors
            var pathRng = makeRng((globalSeed ^ (i * 2654435761)) >>> 0);
            var rowsRng = makeRng(((globalSeed * 1000003) ^ (i * 2246822519)) >>> 0);
            var n = buildNoodle(pathRng, rowsRng, dims, i);
            if (n) noodles.push(n);
        }
    }

    // ---- hatch (SVG export) ----
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

    // ---- canvas ----
    p.registerSketchAPI = function(register){ if(typeof register==='function') register(api); };

    p.setup = function() {
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize);
        canvas.parent(document.getElementById('make-sketch'));
        p.pixelDensity(1); p.noLoop();
        globalSeed = Math.floor(Math.random()*1e8)+1;
        buildAllNoodles();
    };

    function getCellColor(cell) {
        var pal = PARAMS.palette.length ? PARAMS.palette : ['#000000'];
        return pal[cell.colorIdx % pal.length];
    }

    function drawCells(noodle, strokeW) {
        noodle.cells.forEach(function(cell) {
            p.fill(getCellColor(cell));
            if (PARAMS.showBorder) { p.stroke(0); p.strokeWeight(strokeW*1.5); } else p.noStroke();
            p.beginShape();
            cell.quad.forEach(function(pt){ p.vertex(pt.x, pt.y); });
            p.endShape(p.CLOSE);
        });
    }

    p.draw = function() {
        p.background(255);
        paper.drawPaperBorder(p);

        var mp = paper.getMarginPixels(PARAMS.margin);
        var ctx = p.drawingContext;
        var strokeW = Math.max(0.5, paper.mmToPixels(PARAMS.penWidthMm));

        if (PARAMS.viewMode === 'multiply') p.blendMode(p.MULTIPLY);

        // Clip all noodle rendering to the margin area
        ctx.save();
        ctx.beginPath();
        ctx.rect(mp, mp, p.width-2*mp, p.height-2*mp);
        ctx.clip();

        if (PARAMS.overlapMode === 'erase') {
            // Each noodle clips out all previously drawn noodle outlines (evenodd rule)
            var used = [];
            noodles.forEach(function(noodle) {
                ctx.save();
                ctx.beginPath();
                // Margin rect as outer region + used outlines as holes
                ctx.rect(mp, mp, p.width-2*mp, p.height-2*mp);
                used.forEach(function(outline) {
                    ctx.moveTo(outline[0].x, outline[0].y);
                    for (var k=1; k<outline.length; k++) ctx.lineTo(outline[k].x, outline[k].y);
                    ctx.closePath();
                });
                ctx.clip('evenodd');
                drawCells(noodle, strokeW);
                ctx.restore();
                used.push(noodle.outline);
            });
        } else {
            // Layer mode: each noodle cuts a white footprint, then draws on top
            noodles.forEach(function(noodle) {
                p.noStroke(); p.fill(255);
                p.beginShape();
                noodle.outline.forEach(function(pt){ p.vertex(pt.x, pt.y); });
                p.endShape(p.CLOSE);
                drawCells(noodle, strokeW);
            });
        }

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
            '<rect x="0" y="0" width="'+dims.width+'" height="'+dims.height+'" fill="#ffffff"/>',
            '<rect x="1" y="1" width="'+(dims.width-2)+'" height="'+(dims.height-2)+'" fill="none" stroke="#b4b4b4" stroke-width="2"/>',
            '<defs><clipPath id="mc"><rect x="'+fmt(mp)+'" y="'+fmt(mp)+'" width="'+fmt(dims.width-2*mp)+'" height="'+fmt(dims.height-2*mp)+'"/></clipPath></defs>',
            '<g clip-path="url(#mc)">'
        ];
        if (PARAMS.viewMode === 'multiply') parts.push('<g style="mix-blend-mode:multiply">');

        noodles.forEach(function(noodle) {
            var clipOutlines = PARAMS.overlapMode === 'erase'
                ? noodles.filter(function(n){ return n !== noodle; }).map(function(n){ return n.outline; })
                : noodles.filter(function(n){ return n.zIndex > noodle.zIndex; }).map(function(n){ return n.outline; });

            noodle.cells.forEach(function(cell) {
                var hatchDeg = cell.tangAng*180/Math.PI + 90;
                var color = getCellColor(cell);
                hatchQuad(cell.quad, hatchDeg, PARAMS.density).forEach(function(ln) {
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
                noodle.cells.forEach(function(cell) {
                    var pts=cell.quad.map(function(pt){return fmt(pt.x)+','+fmt(pt.y);}).join(' ');
                    parts.push('<polygon points="'+pts+'" fill="none" stroke="#000000" stroke-width="'+fmt(sw*1.5)+'" stroke-linejoin="round"/>');
                });
            }
        });

        if (PARAMS.viewMode === 'multiply') parts.push('</g>');
        parts.push('</g></svg>');
        dlSvg(parts.join('\n'), '90percentart-noodles-'+ts+'.svg');
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
