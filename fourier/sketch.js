//This module instantiates p5 via buildCanvas()
//The global variable "paths" needs to be defined before buildCanvas() is called

var sketch = function(p) {

    var dx = 0.001;
    var dt = 0.003;

    var t = 0;

    var canvasSizeX = 1000;
    var canvasSizeY = 1500;
    var fourierCoeffCount = 50;

    var fSeries = [];
    var parallelCount = 3;
    var currentSeries = 0;


    var pts = [];

    // Persistent layers of all drawn paths
    var drawnPaths;

    p.reset = function(fourierCoefficientCount, parallelDrawCount) {
        fourierCoeffCount = fourierCoefficientCount;
        parallelCount = parallelDrawCount;
        drawnPaths.clear();
        p.clear();
        currentSeries = 0;
        fSeries = [];
        pts = [];
        t = 0;
        for (var j = 0; j < paths.length; j++) {
            var samplesX = [];
            var samplesY = [];

            pts.push(null);
            var i = 0;
            while (i < paths[j].length-1) {
                samplesX.push(i/(2*paths[j].length));
                samplesY.push(ToShiftedCoord(new Complex(paths[j][i], paths[j][i+1])));     
                i = i + 2;
            }
            i = 0;
    
            var len = samplesY.length;
            for (i = 1; i < len; i++) {
                samplesX.push(samplesX[i - 1]+0.5);
                samplesY.push(samplesY[len - i]);
            }
        
            fSeries.push(new FourierSeries(fourierCoeffCount, samplesX, samplesY, dx));
            fSeries[fSeries.length-1].sortByMagnitude();
        }
    }

    p.setup = function() {
        p.createCanvas(canvasSizeX, canvasSizeY);
        drawnPaths = p.createGraphics(canvasSizeX, canvasSizeY);
        p.noFill();
    }

p.draw = function() {
    p.clear();
    p.stroke(200, 200, 200);
    t += dt;
    if (t > 0.5) {
        t = 0;
        currentSeries = currentSeries + parallelCount;
    }
    
    if (currentSeries > fSeries.length)
        currentSeries = 0;
    
    for (var l = currentSeries; l < Math.min(currentSeries + parallelCount, fSeries.length); l++) {
        if (fSeries[l] == null)
            return;
        var vectors = fSeries[l].getVectors(t);
        var pos = ToCanvasCoord(vectors[0]);
        p.strokeWeight(1);
        for (var i = 1; i < vectors.length; i++) {
            if (i < 20) {
                p.stroke(150, 150, 150);
                p.circle(pos.re,pos.im,vectors[i].abs()*2);
            }
            var newPos = pos.add(vectors[i]);
            p.stroke(0, 0, 0);
            p.line(pos.re,pos.im,newPos.re,newPos.im);
            pos = newPos;
        }
        drawnPaths.strokeWeight(1);
        if (pts[l] != null) {
            drawnPaths.stroke(0, 0, 255);
            drawnPaths.line(pts[l].re,pts[l].im,pos.re,pos.im);
        }

        pts[l] = pos;

    }
    
        p.stroke(0, 0, 255);
    p.image(drawnPaths, 0, 0);
}

function ToCanvasCoord(c) {
    return new Complex(c.re + canvasSizeX/2, c.im + canvasSizeY/2)
}

function ToShiftedCoord(c) {
    return new Complex(c.re - canvasSizeX/2, c.im - canvasSizeY/2)
}
  
};

function buildCanvas() {
    return new p5(sketch, 'container');
}