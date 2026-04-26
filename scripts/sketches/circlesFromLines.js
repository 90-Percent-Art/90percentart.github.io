window.sketches = window.sketches || {};
window.sketches['circlesFromLines'] = function(p) {
    var paper = window.makeSketchUtils;
    var PARAMS = {
        paperSize: '8.5x11',
        margin: 1,
        layout: 'polar'
    };

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'layout', label: 'Layout', type: 'select', value: 'polar',
              options: [
                { value: 'polar', label: 'Polar' },
                { value: 'grid', label: 'Grid' },
                { value: 'hex', label: 'Hex' }
              ]},
            { id: 'diameter', label: 'Scale', type: 'range', min: 4, max: 200, step: 1, value: 30 },
            { id: 'maxLines', label: 'Max lines', type: 'range', min: 1, max: 200, step: 1, value: 50 },
            { id: 'ringSpacing', label: 'Padding', type: 'range', min: 0, max: 200, step: 1, value: 30,
              labelByValue: { param: 'layout', values: { polar: 'Ring padding', hex: 'Horizontal padding', default: 'Padding' } } },
            { id: 'withinRingSpacing', label: 'Secondary spacing', type: 'range', min: 0, max: 200, step: 1, value: 10,
              visibleWhen: { param: 'layout', values: ['polar', 'hex'] },
              labelByValue: { param: 'layout', values: { polar: 'Circle spacing', hex: 'Vertical padding', default: 'Secondary spacing' } } },
            { id: 'gradientMode', label: 'Gradient mode', type: 'select', value: 'linear',
              options: [
                { value: 'linear', label: 'Linear' },
                { value: 'polar', label: 'Polar' }
              ],
              visibleWhen: { param: 'layout', values: ['polar'] } },
            { id: 'gradient', label: 'Gradient', type: 'range', min: 0, max: 100, step: 1, value: 100 },
            { id: 'gradientStrength', label: 'Gradient strength', type: 'range', min: 0, max: 200, step: 1, value: 100 },
            { id: 'gradAngle', label: 'Gradient angle°', type: 'range', min: 0, max: 360, step: 1, value: 0 }
        ]),
        regenerate: function(){ resizeIfNeeded(); try{ p.redraw(); }catch(e){} },
        togglePause: function(){ return false; },
        setParam: function(name,val){
            var f=api.params.find(function(x){return x.id===name});
            if(f) f.value=val;
            if (name === 'paperSize') { PARAMS.paperSize = val; resizeIfNeeded(); }
            if (name === 'margin') PARAMS.margin = Number(val);
            if (name === 'layout') PARAMS.layout = val;
        },
        saveSVG: function(){ try { var ts=new Date().toISOString().replace(/[:.]/g,'-'); p.save('circles_from_lines-'+ts+'.svg'); } catch(e){} }
    };

    function resizeIfNeeded() {
        paper.resizeCanvasToPaper(p, PARAMS.paperSize);
    }

    p.registerSketchAPI = function(register){ if(typeof register === 'function') register(api); };

    p.setup = function(){
        var canvas = paper.createPaperCanvas(p, PARAMS.paperSize, p.SVG);
        canvas.parent(document.getElementById('make-sketch'));
        p.strokeWeight(1);
        p.stroke('black');
        p.noFill();
        p.noLoop();
    };

    p.draw = function(){
        p.clear();
        paper.drawPaperBorder(p);
        var diameter = api.params[3].value;
        var maxLines = api.params[4].value;
        var primarySpacing = api.params[5].value;
        var secondarySpacing = api.params[6].value;
        var gradientMode = api.params[7].value;
        var gradient = api.params[8].value / 100;
        var gradientStrength = api.params[9].value / 100;
        var gradAngle = api.params[10].value;

        var marginPx = paper.getMarginPixels(PARAMS.margin);
        var availW = p.width - marginPx * 2;
        var availH = p.height - marginPx * 2;

        if (PARAMS.layout === 'grid') {
            drawGridLayout(marginPx, marginPx, availW, availH, diameter, maxLines, primarySpacing, gradient, gradientStrength, gradAngle);
        } else if (PARAMS.layout === 'hex') {
            drawHexLayout(marginPx, marginPx, availW, availH, diameter, maxLines, primarySpacing, secondarySpacing, gradient, gradientStrength, gradAngle);
        } else {
            drawPolarLayout(marginPx, marginPx, availW, availH, diameter, maxLines, primarySpacing, secondarySpacing, gradient, gradientStrength, gradientMode, gradAngle);
        }
    };

    function drawPolarLayout(left, top, availW, availH, diameter, maxLines, ringSpacing, withinRingSpacing, gradient, gradientStrength, gradientMode, gradAngle) {
        var maxRadius = Math.max(0, Math.min(availW, availH) / 2 - diameter / 2);
        var ringStep = Math.max(1, ringSpacing + diameter / 2);
        var ringCount = Math.max(1, Math.floor(maxRadius / ringStep) + 1);
        var centerX = left + availW / 2;
        var centerY = top + availH / 2;
        p.push();
        p.translate(centerX, centerY);
        drawCircle(0,0, diameter, gradientLines(maxLines, polarGradientPosition(centerX, centerY, centerX, centerY, maxRadius, gradient, gradientMode, left, top, availW, availH, gradAngle), gradientStrength));
        for(var i=1;i<ringCount;i++){
            var ringDiam = i*(2*ringSpacing + diameter);
            var ringCircumf = p.PI*ringDiam;
            var ringRadius = ringDiam/2;
            var circsPerRing = Math.max(1, Math.floor(ringCircumf / Math.max(1, diameter + withinRingSpacing)));
            for(var m=0;m<circsPerRing;m++){
                var theta = 2*p.PI*(m/circsPerRing);
                var worldX = centerX + ringRadius*Math.cos(theta);
                var worldY = centerY + ringRadius*Math.sin(theta);
                p.push();
                p.translate(worldX - centerX, worldY - centerY);
                drawCircle(0,0, diameter, gradientLines(maxLines, polarGradientPosition(worldX, worldY, centerX, centerY, maxRadius, gradient, gradientMode, left, top, availW, availH, gradAngle), gradientStrength));
                p.pop();
            }
        }
        p.pop();
    }

    function drawGridLayout(left, top, availW, availH, diameter, maxLines, padding, gradient, gradientStrength, gradAngle) {
        var pitchX = diameter + Math.max(0, padding);
        var pitchY = diameter + Math.max(0, padding);
        var cols = Math.max(1, Math.floor((availW - diameter) / Math.max(1, pitchX)) + 1);
        var rows = Math.max(1, Math.floor((availH - diameter) / Math.max(1, pitchY)) + 1);
        var contentW = diameter + Math.max(0, cols - 1) * pitchX;
        var contentH = diameter + Math.max(0, rows - 1) * pitchY;
        var startX = left + (availW - contentW) / 2 + diameter / 2;
        var startY = top + (availH - contentH) / 2 + diameter / 2;

        for (var row = 0; row < rows; row++) {
            for (var col = 0; col < cols; col++) {
                var x = startX + col * pitchX;
                var y = startY + row * pitchY;
                p.push();
                p.translate(x, y);
                drawCircle(0, 0, diameter, gradientLines(maxLines, gradientPosition(x, y, left, top, availW, availH, gradAngle), gradientStrength));
                p.pop();
            }
        }
    }

    function drawHexLayout(left, top, availW, availH, diameter, maxLines, gapX, gapY, gradient, gradientStrength, gradAngle) {
        var pitchX = diameter + Math.max(0, gapX);
        var pitchY = Math.sqrt(3) / 2 * diameter + Math.max(0, gapY);
        var cols = Math.max(1, Math.floor((availW - diameter) / Math.max(1, pitchX)) + 1);
        var rows = Math.max(1, Math.floor((availH - diameter) / Math.max(1, pitchY)) + 1);
        var contentW = diameter + Math.max(0, cols - 1) * pitchX + pitchX / 2;
        var contentH = diameter + Math.max(0, rows - 1) * pitchY;
        var startX = left + (availW - contentW) / 2 + diameter / 2;
        var startY = top + (availH - contentH) / 2 + diameter / 2;

        for (var row = 0; row < rows; row++) {
            var rowOffset = (row % 2) * (pitchX / 2);
            for (var col = 0; col < cols; col++) {
                var x = startX + rowOffset + col * pitchX;
                var y = startY + row * pitchY;
                if (x > left + availW - diameter / 2) continue;
                p.push();
                p.translate(x, y);
                drawCircle(0, 0, diameter, gradientLines(maxLines, gradientPosition(x, y, left, top, availW, availH, gradAngle), gradientStrength));
                p.pop();
            }
        }
    }

    function gradientPosition(x, y, left, top, availW, availH, angleDeg) {
        var cx = left + availW / 2;
        var cy = top + availH / 2;
        var dx = x - cx;
        var dy = y - cy;
        var theta = p.radians(angleDeg);
        var axisX = Math.sin(theta);
        var axisY = Math.cos(theta);
        var projection = dx * axisX + dy * axisY;
        var maxProjection = (Math.abs(axisX) * availW + Math.abs(axisY) * availH) / 2;
        if (maxProjection <= 0) return 0;
        return p.constrain((projection + maxProjection) / (2 * maxProjection), 0, 1);
    }

    function polarGradientPosition(x, y, centerX, centerY, maxRadius, gradientCenter, gradientMode, left, top, availW, availH, angleDeg) {
        if (gradientMode === 'polar') {
            if (maxRadius <= 0) return 0;
            var dx = x - centerX;
            var dy = y - centerY;
            var radiusT = p.constrain(Math.sqrt(dx * dx + dy * dy) / maxRadius, 0, 1);
            return Math.abs(radiusT - gradientCenter) * 2;
        }
        return gradientPosition(x, y, left, top, availW, availH, angleDeg);
    }

    function gradientLines(maxLines, t, strength) {
        var clampedT = p.constrain(t, 0, 1);
        var clampedStrength = p.constrain(strength, 0, 2);
        var shapedT = clampedStrength <= 1
            ? clampedT
            : Math.pow(clampedT, 1 / (1 + (clampedStrength - 1) * 3));
        var fade = 1 - shapedT;
        var mix = clampedStrength <= 1
            ? ((1 - clampedStrength) + (clampedStrength * fade))
            : fade;
        return Math.max(0, Math.round(maxLines * mix));
    }

    function drawCircle(x,y,d,n){
        var z = d/2;
        for(var k=1;k<n;k++){
            var theta1 = p.random(0,2*p.PI);
            var theta2 = p.random(0,2*p.PI);
            var x1 = z*Math.cos(theta1), y1 = z*Math.sin(theta1);
            var x2 = z*Math.cos(theta2), y2 = z*Math.sin(theta2);
            p.line(x1,y1,x2,y2);
            p.ellipse(x1,y1,3);
            p.ellipse(x2,y2,3);
        }
    }
};
