window.sketches = window.sketches || {};
window.sketches['circlesFromLines'] = function(p) {
    var api = {
        params: [
            { id: 'diameter', label: 'Diameter', type: 'range', min: 4, max: 200, step: 1, value: 30 },
            { id: 'maxLines', label: 'Max lines', type: 'range', min: 1, max: 200, step: 1, value: 50 },
            { id: 'numRings', label: 'Num rings', type: 'range', min: 0, max: 40, step: 1, value: 10 },
            { id: 'ringSpacing', label: 'Ring spacing', type: 'range', min: 1, max: 200, step: 1, value: 30 },
            { id: 'withinRingSpacing', label: 'Within ring spacing', type: 'range', min: 1, max: 200, step: 1, value: 10 }
        ],
        regenerate: function(){ try{ p.redraw(); }catch(e){} },
        togglePause: function(){ return false; },
        setParam: function(name,val){ var f=api.params.find(function(x){return x.id===name}); if(f) f.value=val; },
        saveSVG: function(){ try { var ts=new Date().toISOString().replace(/[:.]/g,'-'); p.save('circles_from_lines-'+ts+'.svg'); } catch(e){} }
    };

    p.registerSketchAPI = function(register){ if(typeof register === 'function') register(api); };

    p.setup = function(){
        var canvas = p.createCanvas(1000,1000,p.SVG);
        canvas.parent(document.getElementById('make-sketch'));
        p.strokeWeight(1);
        p.stroke('black');
        p.noFill();
        p.noLoop();
    };

    p.draw = function(){
        p.clear();
        var diameter = api.params[0].value;
        var maxLines = api.params[1].value;
        var numRings = api.params[2].value;
        var ringSpacing = api.params[3].value;
        var withinRingSpacing = api.params[4].value;

        var xsize = p.width, ysize = p.height;
        p.push();
        p.translate(xsize/2, ysize/2);
        drawCircle(0,0, diameter, maxLines);
        for(var i=1;i<numRings;i++){
            var ringDiam = i*(2*ringSpacing + diameter);
            var ringCircumf = p.PI*ringDiam;
            var ringRadius = ringDiam/2;
            var circsPerRing = Math.floor(ringCircumf/(withinRingSpacing+diameter));
            for(var m=0;m<circsPerRing;m++){
                var theta = 2*p.PI*(m/circsPerRing);
                p.push();
                p.translate(ringRadius*Math.cos(theta), ringRadius*Math.sin(theta));
                drawCircle(0,0, diameter, Math.floor(maxLines*(1-i/numRings)));
                p.pop();
            }
        }
        p.pop();
    };

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
