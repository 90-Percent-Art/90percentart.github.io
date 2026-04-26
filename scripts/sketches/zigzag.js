window.sketches = window.sketches || {};
window.sketches['zigzag'] = function(p) {
    var paper = window.makeSketchUtils;

    var PARAMS = {
        paperSize: '8.5x11',
        margin: 1,
        BLOCK_COUNT: 0,
        HATCH_SPACING: 3.5,
        HATCH_JITTER: 0.4,
        HATCH_WEIGHT_MM: 0.4,
        CURVE_ENABLED: true,
        CURVE_MAG: 1,
        CURVE_FREQ: 0.5,
        ALPHA: 200,
        COLOR_MODE: 'perShape'
    };

    var PALETTE = ['#c85a5a','#6aa6d1','#d1a86a','#6ad1a2','#8f79c8'];
    var blocks = [];
    var paused = false;

    var api = {
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'blockCount',    label: 'Block count',    type: 'range', min: 0, max: 8,    step: 1,    value: 0 },
            { id: 'hatchSpacing',  label: 'Hatch spacing',  type: 'range', min: 1, max: 12,   step: 1,    value: 4 },
            { id: 'hatchWeight',   label: 'Pen width (mm)', type: 'range', min: 0.1, max: 2.0, step: 0.1, value: 0.4 },
            { id: 'hatchJitter',   label: 'Line jitter',    type: 'range', min: 0, max: 10,   step: 1,    value: 4,
              _toInternal: function(v){ return v/10; } },
            { id: 'curveMag',      label: 'Curve mag',      type: 'range', min: 0, max: 30,   step: 1,    value: 10,
              _toInternal: function(v){ return v/10; } },
            { id: 'alpha',         label: 'Opacity',        type: 'range', min: 10, max: 255, step: 5,    value: 200 }
        ]),
        regenerate: function() { resizeIfNeeded(); p.redraw(); },
        togglePause: function() { paused = !paused; return paused; },
        randomize: function() { randomizeAll(); p.redraw(); },
        setParam: function(name, val) {
            var pdef = api.params.find(function(x){ return x.id === name; });
            if (pdef) pdef.value = val;
            applyParam(name, val);
        }
    };

    function applyParam(name, rawVal) {
        var pdef = api.params.find(function(x){ return x.id === name; });
        var val = (pdef && pdef._toInternal) ? pdef._toInternal(rawVal) : rawVal;
        if (name === 'paperSize')   PARAMS.paperSize = val;
        if (name === 'margin')      PARAMS.margin = Number(val);
        if (name === 'blockCount')   PARAMS.BLOCK_COUNT = val;
        if (name === 'hatchSpacing') PARAMS.HATCH_SPACING = val;
        if (name === 'hatchWeight')  PARAMS.HATCH_WEIGHT_MM = Number(val);
        if (name === 'hatchJitter')  PARAMS.HATCH_JITTER = val;
        if (name === 'curveMag')     PARAMS.CURVE_MAG = val;
        if (name === 'alpha')        { PARAMS.ALPHA = val; for (var b of blocks) setBlockAlpha(b, val); }
        if (name === 'paperSize' || name === 'margin' || name === 'blockCount') randomizeAll();
    }

    function resizeIfNeeded() {
        paper.resizeCanvasToPaper(p, PARAMS.paperSize);
    }

    p.registerSketchAPI = function(register) { if (typeof register === 'function') register(api); };

    p.setup = function() {
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize);
        canvas.parent(document.getElementById('make-sketch'));
        p.pixelDensity(1);
        p.noLoop();
        randomizeAll();
    };

    p.draw = function() {
        if (paused) return;
        p.background(255);
        paper.drawPaperBorder(p);
        for (var b of blocks) drawZigBlock(b);
    };

    // ---- color helpers ----
    function makeColorWithAlpha(hex) {
        var c = p.color(hex);
        c.setAlpha(PARAMS.ALPHA);
        return c;
    }

    function buildColors(rectCount, connCount) {
        var colors = { rects: [], conns: [] };
        for (var i = 0; i < rectCount; i++) colors.rects.push(makeColorWithAlpha(p.random(PALETTE)));
        for (var i = 0; i < connCount; i++)  colors.conns.push(makeColorWithAlpha(p.random(PALETTE)));
        return colors;
    }

    function setBlockAlpha(block, alpha) {
        var setA = function(col) { if (col) col.setAlpha(alpha); };
        block.colors.rects.forEach(setA);
        block.colors.conns.forEach(setA);
    }

    // ---- geometry helpers ----
    function normal2(dx, dy) { var L = Math.hypot(dx,dy)||1; return {x:-dy/L, y:dx/L}; }

    function segIntersectT(P,Q,A,B) {
        var rx=Q.x-P.x, ry=Q.y-P.y, sx=B.x-A.x, sy=B.y-A.y;
        var den = rx*sy - ry*sx;
        if (Math.abs(den) < 1e-12) return null;
        var t = ((A.x-P.x)*sy - (A.y-P.y)*sx) / den;
        var u = ((A.x-P.x)*ry - (A.y-P.y)*rx) / den;
        return (t>=0 && t<=1 && u>=0 && u<=1) ? t : null;
    }

    function hatchPolygon(poly, angle, spacing, jitter, weight) {
        var dir = {x:Math.cos(angle), y:Math.sin(angle)};
        var nrm = normal2(dir.x, dir.y);
        var proj = function(pt) { return nrm.x*pt.x + nrm.y*pt.y; };
        var minP=Infinity, maxP=-Infinity;
        poly.forEach(function(pt){ var pr=proj(pt); if(pr<minP)minP=pr; if(pr>maxP)maxP=pr; });
        var pad = 2*spacing;
        var minK = Math.floor((minP-pad)/spacing);
        var maxK = Math.ceil((maxP+pad)/spacing);

        for (var k=minK; k<=maxK; k++) {
            var off = k*spacing;
            var p0 = {x:-5000*dir.x+off*nrm.x, y:-5000*dir.y+off*nrm.y};
            var p1 = {x: 5000*dir.x+off*nrm.x, y: 5000*dir.y+off*nrm.y};
            var ts = [];
            for (var i=0; i<poly.length; i++) {
                var A=poly[i], B=poly[(i+1)%poly.length];
                var t = segIntersectT(p0,p1,A,B);
                if (t!==null) ts.push(t);
            }
            ts.sort(function(a,b){return a-b;});
            for (var i=0; i+1<ts.length; i+=2) {
                var AA = {x:p0.x+(p1.x-p0.x)*ts[i],   y:p0.y+(p1.y-p0.y)*ts[i]};
                var BB = {x:p0.x+(p1.x-p0.x)*ts[i+1], y:p0.y+(p1.y-p0.y)*ts[i+1]};
                var jx = jitter ? p.randomGaussian(0,jitter) : 0;
                var jy = jitter ? p.randomGaussian(0,jitter) : 0;
                drawHatchLine({x:AA.x+jx, y:AA.y+jy}, {x:BB.x+jx, y:BB.y+jy});
            }
        }
    }

    function drawHatchLine(A, B) {
        if (!PARAMS.CURVE_ENABLED) { p.line(A.x,A.y,B.x,B.y); return; }
        var dx=B.x-A.x, dy=B.y-A.y;
        var len=Math.hypot(dx,dy)||1;
        var nx=-dy/len, ny=dx/len;
        var phase=p.random(p.TWO_PI);
        var lenScale=p.constrain(len/30,0,1);
        var amp=PARAMS.CURVE_MAG*lenScale;
        var freq=PARAMS.CURVE_FREQ*lenScale+0.0001;
        p.noFill();
        p.beginShape();
        for (var i=0;i<=8;i++) {
            var t=i/8;
            var off=Math.sin(phase+t*freq*p.TWO_PI)*amp;
            p.vertex(A.x+dx*t+nx*off, A.y+dy*t+ny*off);
        }
        p.endShape();
    }

    // ---- block generation ----
    function sampleRectAngle() {
        return p.radians(p.constrain(p.randomGaussian(0,55),-80,80));
    }

    function sampleAngles(count) {
        var angles = [], minSep = p.radians(10);
        for (var i=0;i<count;i++) {
            var ang, tries=0;
            do { ang = sampleRectAngle(); tries++; }
            while (i>0 && Math.abs(Math.atan2(Math.sin(ang-angles[i-1]),Math.cos(ang-angles[i-1])))<minSep && tries<40);
            angles.push(ang);
        }
        return angles;
    }

    function sampleConnAngle() {
        var base = p.random([20,30,40,50,60,70]);
        var usePos = p.random() < 0.75;
        if (usePos) {
            return p.radians(p.random()<0.5 ? base : 180-base);
        } else {
            return p.radians(p.random()<0.5 ? 180+base : 360-base);
        }
    }

    function sampleOffset(h) {
        var ang = sampleConnAngle();
        var cosA=Math.cos(ang), sinA=Math.sin(ang);
        var maxX=260, maxY=320;
        var lims=[];
        if (Math.abs(cosA)>1e-4) lims.push(Math.abs(maxX/cosA));
        if (sinA>0)  lims.push(maxY/sinA);
        if (sinA<0)  lims.push(Math.abs(maxY/sinA));
        var maxLen = lims.length ? Math.min.apply(null,lims.filter(function(n){return isFinite(n)&&n>0;})) : 150;
        maxLen = Math.min(maxLen, h*2.5);
        var minLen = Math.min(Math.max(h*0.5,40),maxLen);
        if (minLen>maxLen) minLen=maxLen*0.9;
        var len = p.random(minLen,maxLen);
        return {x:len*cosA, y:len*sinA};
    }

    function makeZigBlock() {
        var w = p.random(200,340), h = p.random(90,140);
        var segCount = p.random([3,5,7]);
        var rectCount = (segCount+1)>>1;
        var conns = rectCount-1;
        var offs = [];
        for (var k=0;k<conns;k++) offs.push(sampleOffset(h));

        var x=0, y=0, minx=0, maxx=w, miny=-h, maxy=0;
        for (var o of offs) {
            x+=o.x; y+=o.y;
            minx=Math.min(minx,x); maxx=Math.max(maxx,x+w);
            miny=Math.min(miny,y-h); maxy=Math.max(maxy,y);
        }
        var pad = Math.max(24, paper.getMarginPixels(PARAMS.margin));
        var baseX=p.random(pad-minx, p.width-pad-maxx);
        var baseY=p.random(pad-miny, p.height-pad-maxy);

        var rects=[];
        var cur={x:baseX, y:baseY};
        rects.push({bl:{x:cur.x,y:cur.y}, w:w, h:h});
        for (var o of offs) {
            cur={x:cur.x+o.x, y:cur.y+o.y};
            rects.push({bl:{x:cur.x,y:cur.y}, w:w, h:h});
        }

        return {
            rects: rects,
            offs: offs,
            colors: buildColors(rectCount,conns),
            angles: sampleAngles(rectCount),
            seed: Math.floor(p.random(1, 1000000000))
        };
    }

    function rectCorners(bl,w,h) {
        return [
            {x:bl.x,   y:bl.y},
            {x:bl.x+w, y:bl.y},
            {x:bl.x+w, y:bl.y-h},
            {x:bl.x,   y:bl.y-h}
        ];
    }

    function drawZigBlock(block) {
        var sp=PARAMS.HATCH_SPACING, jt=PARAMS.HATCH_JITTER, wt=Math.max(0.5, paper.mmToPixels(PARAMS.HATCH_WEIGHT_MM));
        var g = p.createGraphics(p.width, p.height);
        g.strokeCap(p.SQUARE);
        g.noFill();
        g.strokeWeight(wt);
        p.randomSeed(block.seed);

        // rectangles
        for (var i=0;i<block.rects.length;i++) {
            var rect=block.rects[i];
            var poly=rectCorners(rect.bl,rect.w,rect.h);
            g.stroke(block.colors.rects[i]||block.colors.rects[0]);
            hatchPolygonG(g, poly, block.angles[i], sp, jt, wt);
        }

        // connectors
        for (var i=0;i<block.rects.length-1;i++) {
            var rA=block.rects[i], rB=block.rects[i+1];
            var [a0,a1,a2,a3]=rectCorners(rA.bl,rA.w,rA.h);
            var [b0,b1,b2,b3]=rectCorners(rB.bl,rB.w,rB.h);
            var poly=[a2,a3,b0,b1];
            var connAng = Math.atan2(Math.sin(block.angles[i])+Math.sin(block.angles[i+1]),
                                     Math.cos(block.angles[i])+Math.cos(block.angles[i+1]));
            g.stroke(block.colors.conns[i]||block.colors.rects[i]||block.colors.rects[0]);
            hatchPolygonG(g, poly, connAng, sp, jt, wt);
        }

        p.push();
        p.blendMode(p.MULTIPLY);
        p.image(g,0,0);
        p.pop();
        g.remove();
    }

    // version of hatchPolygon that draws into a graphics buffer g
    function hatchPolygonG(g, poly, angle, spacing, jitter, weight) {
        var dir={x:Math.cos(angle),y:Math.sin(angle)};
        var nrm={x:-dir.y, y:dir.x};
        var proj=function(pt){return nrm.x*pt.x+nrm.y*pt.y;};
        var minP=Infinity, maxP=-Infinity;
        poly.forEach(function(pt){var pr=proj(pt); if(pr<minP)minP=pr; if(pr>maxP)maxP=pr;});
        var pad=2*spacing, minK=Math.floor((minP-pad)/spacing), maxK=Math.ceil((maxP+pad)/spacing);
        g.strokeWeight(weight); g.noFill(); g.strokeCap(p.SQUARE);
        for (var k=minK;k<=maxK;k++) {
            var off=k*spacing;
            var p0={x:-5000*dir.x+off*nrm.x,y:-5000*dir.y+off*nrm.y};
            var p1={x: 5000*dir.x+off*nrm.x,y: 5000*dir.y+off*nrm.y};
            var ts=[];
            for (var i=0;i<poly.length;i++){
                var A=poly[i],B=poly[(i+1)%poly.length];
                var t=segIntersectT(p0,p1,A,B);
                if(t!==null)ts.push(t);
            }
            ts.sort(function(a,b){return a-b;});
            for (var i=0;i+1<ts.length;i+=2){
                var AA={x:p0.x+(p1.x-p0.x)*ts[i],   y:p0.y+(p1.y-p0.y)*ts[i]};
                var BB={x:p0.x+(p1.x-p0.x)*ts[i+1], y:p0.y+(p1.y-p0.y)*ts[i+1]};
                var jx=jitter?p.randomGaussian(0,jitter):0;
                var jy=jitter?p.randomGaussian(0,jitter):0;
                drawHatchLineG(g,{x:AA.x+jx,y:AA.y+jy},{x:BB.x+jx,y:BB.y+jy});
            }
        }
    }

    function drawHatchLineG(g, A, B) {
        if (!PARAMS.CURVE_ENABLED) { g.line(A.x,A.y,B.x,B.y); return; }
        var dx=B.x-A.x, dy=B.y-A.y, len=Math.hypot(dx,dy)||1;
        var nx=-dy/len, ny=dx/len;
        var phase=p.random(p.TWO_PI);
        var lenScale=Math.min(len/30,1);
        var amp=PARAMS.CURVE_MAG*lenScale;
        var freq=PARAMS.CURVE_FREQ*lenScale+0.0001;
        g.noFill(); g.beginShape();
        for (var i=0;i<=8;i++){
            var t=i/8, off=Math.sin(phase+t*freq*p.TWO_PI)*amp;
            g.vertex(A.x+dx*t+nx*off, A.y+dy*t+ny*off);
        }
        g.endShape();
    }

    function randomizeAll() {
        blocks.length=0;
        var n=PARAMS.BLOCK_COUNT>0?PARAMS.BLOCK_COUNT:Math.floor(p.random(1,7));
        for (var i=0;i<n;i++) blocks.push(makeZigBlock());
    }
};
