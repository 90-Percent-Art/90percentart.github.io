window.sketches = window.sketches || {};
window.sketches['blendTest'] = function(p) {
    var paper = window.makeSketchUtils;
    var PARAMS = {
        paperSize: '8.5x11',
        margin: 0.5,
        viewMode: 'normal',
        opacity: 80
    };

    var api = {
        hasPause: false,
        params: paper.buildPaperParams(PARAMS.paperSize, PARAMS.margin).concat([
            { id: 'viewMode', label: 'Blend mode', type: 'select', value: 'normal',
              options: [
                { value: 'normal',   label: 'Normal (alpha)' },
                { value: 'multiply', label: 'Multiply (ink)' }
              ]},
            { id: 'opacity', label: 'Opacity %', type: 'range', min: 10, max: 100, step: 5, value: 80 }
        ]),
        regenerate: function(){ try{ p.redraw(); }catch(e){} },
        reseed:     function(){ try{ p.redraw(); }catch(e){} },
        getRecipe: function() {
            return { state: {} };
        },
        applyRecipeState: function() {
            try{ p.redraw(); }catch(e){}
        },
        togglePause: function(){ return false; },
        setParam: function(name, val) {
            var f = api.params.find(function(x){ return x.id === name; });
            if (f) f.value = val;
            if (name === 'paperSize') { PARAMS.paperSize = val; paper.resizeCanvasToPaper(p, val); }
            if (name === 'margin')    PARAMS.margin  = Number(val);
            if (name === 'viewMode')  PARAMS.viewMode = val;
            if (name === 'opacity')   PARAMS.opacity  = Number(val);
        },
        saveSVG: function() {}
    };

    p.registerSketchAPI = function(register){ if(typeof register === 'function') register(api); };

    p.setup = function(){
        paper.createPaperCanvas(p, PARAMS.paperSize).parent(document.getElementById('make-sketch'));
        p.noLoop();
    };

    p.draw = function(){
        p.background(255);

        var isMultiply = PARAMS.viewMode === 'multiply';
        p.blendMode(isMultiply ? p.MULTIPLY : p.BLEND);

        var m   = paper.getMarginPixels(PARAMS.margin);
        var w   = p.width  - m * 2;
        var h   = p.height - m * 2;
        var cx  = m + w / 2;
        var cy  = m + h / 2 - h * 0.04;
        var r   = Math.min(w, h) * 0.28;
        var off = r * 0.55;
        var a   = Math.round(PARAMS.opacity / 100 * 255);

        p.noStroke();

        // Cyan  — top
        p.fill(0, 255, 255, a);
        p.ellipse(cx, cy - off, r * 2, r * 2);

        // Magenta — bottom-left
        p.fill(255, 0, 255, a);
        p.ellipse(cx - off * 0.866, cy + off * 0.5, r * 2, r * 2);

        // Yellow — bottom-right
        p.fill(255, 255, 0, a);
        p.ellipse(cx + off * 0.866, cy + off * 0.5, r * 2, r * 2);

        // Reset blend before text
        p.blendMode(p.BLEND);
        p.noStroke();

        // Labels in overlap zones
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.max(10, r * 0.18));

        var labelOff = off * 0.72;
        p.fill(0);

        // C only label
        p.text('Cyan', cx, cy - off - r * 0.35);
        // M only label
        p.text('Magenta', cx - off * 0.866 - r * 0.35, cy + off * 0.5 + r * 0.35);
        // Y only label
        p.text('Yellow', cx + off * 0.866 + r * 0.35, cy + off * 0.5 + r * 0.35);

        // Overlap labels
        p.textSize(Math.max(9, r * 0.15));
        p.fill(isMultiply ? 0 : 80);
        p.text(isMultiply ? 'Blue' : 'C+M', cx - labelOff * 0.5, cy - labelOff * 0.28);
        p.text(isMultiply ? 'Green' : 'C+Y', cx + labelOff * 0.5, cy - labelOff * 0.28);
        p.text(isMultiply ? 'Red' : 'M+Y', cx, cy + labelOff * 0.55);
        p.text(isMultiply ? '≈Black' : 'C+M+Y', cx, cy + labelOff * 0.05);

        // Footer
        p.fill(100);
        p.textSize(Math.max(9, r * 0.13));
        p.textAlign(p.CENTER, p.TOP);
        p.text(
            isMultiply
                ? 'Multiply: subtractive (ink) mixing — overlaps darken like real pigments'
                : 'Normal: alpha compositing — overlaps blend additively',
            cx, m + h + 6
        );
    };
};
