window.sketches = window.sketches || {};
window.sketches['cmyk'] = function(p) {
    var colorGrid = [];
    var angleGrid = [];
    var startColor = [0,18,34,37];
    var endColor = [34,16,0,37];
    var margin = 100;
    var paused = false;

    var api = {
        regenerate: function() {
            // redraw once
            try { p.redraw(); } catch(e) {}
        },
        togglePause: function() {
            paused = !paused;
            return paused;
        },
        saveSVG: function() {
            try {
                var ts = new Date().toISOString().replace(/[:.]/g,'-');
                p.save('90percentart-cmyk-'+ts+'.svg');
            } catch(e) { console.error('saveSVG failed', e); }
        }
    };

    p.registerSketchAPI = function(register) {
        if (typeof register === 'function') register(api);
    };

    p.setup = function() {
        // create an SVG canvas (size will be container-dependent if you prefer)
        // keep the original fixed size for fidelity
        var canvas = p.createCanvas(1200, 1200, p.SVG);
        canvas.parent(document.getElementById('make-sketch'));
        p.strokeWeight(1);
        p.noLoop();
    };

    // Removed automatic mousePressed save to avoid saving when clicking UI elements.
    // Use the Save SVG button (wired to window.sketchAPI.saveSVG) instead.

    p.draw = function() {
        if (paused) return;
        p.background(255,255,255);

        colorGrid = makeColorGrid(20,20, startColor, endColor);
        angleGrid = makeAnglerGrid(20,20,0.1);

        for (var i = 0; i < 20; i++){
            for (var j = 0; j < 20; j++){
                p.push();
                p.translate(margin + i*50, margin + j*50);
                var f = colorGrid[i][j];
                p.stroke(p.color(f[0], f[1], f[2]));
                drawLineCircle(0,0,50,50,f, angleGrid[i][j]*2*p.PI);
                p.pop();
            }
        }
    };

    function drawLineCircle(x,y, d, n, cmy, theta){
        var r = d/2;
        var yloc = 0;
        var xloc = 0;
        var stepSize = d/n;

        p.push();
        p.translate(x,y);
        p.rotate(theta);
        for (var l = 1; l < n; l++){
            p.stroke(getRandomColor(cmy));
            xloc = Math.sqrt(r*r - yloc*yloc);
            p.line(-xloc, yloc, xloc, yloc);
            p.line(-xloc, -yloc, xloc, -yloc);
            yloc += stepSize;
        }
        p.line(-r,0,r,0);
        p.pop();
    }

    function getRandomColor(cmyk){
        var c = cmyk[0];
        var m = cmyk[1];
        var y = cmyk[2];
        var k = cmyk[3];
        var total = c + m + y + k;
        var rval = p.random(0,1);
        if (rval < c/total){
            return p.color('cyan');
        } else if (rval < (c+m)/total){
            return p.color('magenta');
        } else if (rval < (c+m+y)/total){
            return p.color('yellow');
        } else {
            return p.color('black');
        }
    }

    function makeColorGrid(nrow, ncol, start, end){
        var grid = new Array(nrow);
        for (var i = 0; i < nrow; i++){
            grid[i] = new Array(ncol);
            for (var j = 0; j < ncol; j++){
                grid[i][j] = arrayLerp(start, end, i / nrow);
            }
        }
        return grid;
    }

    function makeAnglerGrid(nrow, ncol, size){
        var grid = new Array(nrow);
        for (var i = 0; i < nrow; i++){
            grid[i] = new Array(ncol);
            for (var j = 0; j < ncol; j++){
                grid[i][j] = p.noise(i*size, j*size);
            }
        }
        return grid;
    }

    function arrayLerp(first, second, pct){
        var result = [];
        for (var k = 0; k < first.length; k++){
            result.push(first[k] * (1-pct) + second[k] * pct);
        }
        return result;
    }
};
