"use strict";

import * as THREE from './three.module.js';
import { OrbitControls } from '/OrbitControls.js';
import { LineMaterial } from './LineMaterial.js';
import { LineGeometry } from './LineGeometry.js';
import { Line2 } from './Line2.js';
import { GUI } from './dat.gui.module.js';
import Stats from './stats.module.js'


var camera, orthCamera, controls, scene, orthScene, renderer;
var baseSpace_geometry, baseSpace_material, baseSpace;
var baseSpaceCircles = [];
var compressToBall = true;
var stats;
var gui, globalOptions, baseSpaceOptions, appliedRotation;
var defaultRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI/2);
var fiberResolution = 250;
var maxFiberResolution = 500;

// Returns the fiber of a given base point under the Hopf map via a given resolution (i.e. resolution specifies the number of points on the fiber to compute)
function hopfFiber1(basePoint, resolution) {
    var r1 = new THREE.Quaternion(0, 1 + basePoint.x, basePoint.y, basePoint.z);
    r1.multiply(new THREE.Quaternion(1/Math.sqrt(2+2*basePoint.x),0,0,0));
    var fiber = [];
    for(var i = 0; i < resolution; i++) {
        var pt = new THREE.Quaternion;
        pt.multiplyQuaternions(r1, new THREE.Quaternion(Math.cos(2*Math.PI*i/resolution), Math.sin(2*Math.PI*i/resolution), 0, 0));
        fiber.push(pt);
    }
    return fiber;
}

// Stereographically prohjects a set of points in 4D space (given as Quaternions) from the north pole of the 3-sphere into 3-space
function stereographicProjection(points) {
    var proj = [];
    for (var i = 0; i < points.length; i++) {
    var denominator = Math.max(1 - points[i].x, 0.001);
    var pt = new THREE.Vector3(points[i].y / denominator, points[i].z / denominator, points[i].w / denominator);
    proj[i] = pt;
    }
    if (!compressToBall)
        proj.push(proj[0]);
    return proj;
}

// Continuous deformation of points in R^3 (given as an array of Vector3) to a unit ball
function compressR3ToBall(points) {
    for (var i = 0; i < points.length; i++) {
        var dist = points[i].distanceTo(new THREE.Vector3(0,0,0));
        //var scaling =1/(1+dist);
        var scaling = (dist/Math.sqrt((1+dist*dist)))/dist;
        points[i].x = points[i].x*scaling;
        points[i].y = points[i].y*scaling;
        points[i].z = points[i].z*scaling;
    }
    if (compressToBall)
        points.push(points[0]);
    return points;
}

// reference: https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function rainbow(p, m) {
    var rgb = HSVtoRGB(p/m*0.85, 1.0, 1.0);
    return new THREE.Vector3(rgb.r,rgb.g,rgb.b);
}

// O--------------------------------------------------------------------------------------------O
// | Encapsulates a (discretized) circle in the base space unit sphere and the                  |
// | stereographic projections of the fibers of these discrete points under the Hopf map.       |
// | The class contains the base circle parameters, the base circle geometry/material/object,   |
// | as well as the projected fiber geometries/materials/objects.                               |
// | The constructor creates these objects as parametrized and adds them to the scene, a call   |
// | of destroy() removes them from the scene.                                                  |
// O--------------------------------------------------------------------------------------------O
class baseSpaceCircle {

    distanceToCenter;
    distanceToCenter_radians;
    circumference;
    pointCount;
    defaultRotation;
    appliedRotation_axis;
    appliedRotation_angle;
    appliedRotation_quaternion;

    base_geometry;
    base_material;
    base_object;

    projectedCircles_geometries = [];
    projectedCircles_materials = [];
    projectedCircles_objects = [];

    /*  Base Space Parametrization
        Returns the coordinate of a point on the circle inside the base space, where 0 <= pointIndex < pointCount   */
    pointCoordinate(pointIndex) {
        return new THREE.Vector3(Math.cos(this.distanceToCenter_radians)*Math.sin(this.circumference * pointIndex / this.pointCount), 
                                 Math.sin(this.distanceToCenter_radians), 
                                 Math.cos(this.distanceToCenter_radians)*Math.cos(this.circumference * pointIndex / this.pointCount));
    }

    rotate() {
        for (var vertex in this.base_geometry.vertices)
            this.base_geometry.vertices[vertex].applyQuaternion(this.appliedRotation_quaternion);
        this.base_geometry.verticesNeedUpdate = true;
    }

    setAppliedRotation() {
        if ((this.appliedRotation_angle.x < 0.001) && (this.appliedRotation_angle.y < 0.001) && (this.appliedRotation_angle.z < 0.001))
            baseSpaceCircles[index].appliedRotation_angle = 0;
        this.appliedRotation_quaternion = new THREE.Quaternion().setFromAxisAngle(this.appliedRotation_axis.normalize(), this.appliedRotation_angle);
    }

    // Recalculates the projected fiber vertex positions
    updateFiberProjections() {
        for (var vertex in this.base_geometry.vertices) {
            var projectedCirclePts = stereographicProjection(hopfFiber1(this.base_geometry.vertices[vertex], fiberResolution));
            if (compressToBall)
                projectedCirclePts = compressR3ToBall(projectedCirclePts);
            var projectedCirclePts_ = [];
            for (var i = 0; i < fiberResolution+1; i++)
                projectedCirclePts_.push(projectedCirclePts[i].x, projectedCirclePts[i].y, projectedCirclePts[i].z);
            this.projectedCircles_objects[vertex].geometry.setPositions(projectedCirclePts_);
        }
    }

    destroy() {
        this.base_geometry.dispose();
        this.base_material.dispose();
        orthScene.remove(this.base_object);
        for (var index in this.projectedCircles_objects) {
            this.projectedCircles_geometries[index].dispose();
            this.projectedCircles_materials[index].dispose();
            scene.remove(this.projectedCircles_objects[index]);
        }
            
    }

    constructor(distanceToCenter, circumference, pointCount, defaultRotation, appliedRotation_axis, appliedRotation_angle) {

        this.distanceToCenter = distanceToCenter;
        this.circumference = circumference;
        this.pointCount = pointCount;
        this.defaultRotation = defaultRotation;
        this.appliedRotation_axis = appliedRotation_axis;
        this.appliedRotation_angle = appliedRotation_angle;
        this.appliedRotation_quaternion = new THREE.Quaternion().setFromAxisAngle(appliedRotation_axis.normalize(), appliedRotation_angle);

        // Calculate the vertex positions and colors for a circle with y-distance=distanceToCenter
        this.distanceToCenter_radians = distanceToCenter*Math.PI/2;
        this.base_geometry = new THREE.Geometry();
        for(var j = 0; j < pointCount; j++) {
            var pt = this.pointCoordinate(j);
            pt.applyQuaternion(defaultRotation);
            var color = rainbow(j, pointCount);
            this.base_geometry.vertices.push(pt);
            this.base_geometry.colors.push(new THREE.Color(color.x/255,color.y/255,color.z/255));
        }

        // Add the base space points to the scene
        this.base_material = new THREE.PointsMaterial( { size: 5, sizeAttenuation: false, vertexColors: THREE.VertexColors } );
        this.base_object = new THREE.Points(this.base_geometry, this.base_material);
        orthScene.add(this.base_object);

        // For each new point on the base space, calculate the stereographically projected fiber under the Hopf map and add it to the scene
        for (var vertex in this.base_geometry.vertices) {

            var projectedCirclePts = stereographicProjection(hopfFiber1(this.base_geometry.vertices[vertex], maxFiberResolution));
            if (compressToBall)
                projectedCirclePts = compressR3ToBall(projectedCirclePts);
            var projectedCirclePts_ = [];
            for (var i = 0; i < maxFiberResolution+1; i++)
                projectedCirclePts_.push(projectedCirclePts[i].x, projectedCirclePts[i].y, projectedCirclePts[i].z);

            var colors = [];
            for (var i = 0; i < maxFiberResolution+1; i++)
                colors.push(this.base_geometry.colors[vertex].r, this.base_geometry.colors[vertex].g, this.base_geometry.colors[vertex].b);

            var geomLine = new LineGeometry();
            geomLine.setColors(colors);
            geomLine.setPositions(projectedCirclePts_);
            this.projectedCircles_geometries.push(geomLine);

            var matLine = new LineMaterial( {
                color: 0xffffff,
                linewidth: 0.003, // in pixels
                vertexColors: true,
                dashed: false
            } );

            var line = new Line2(geomLine, matLine)
            line.computeLineDistances();
            line.scale.set( 1, 1, 1 );

            this.projectedCircles_materials.push(matLine);
            this.projectedCircles_geometries.push(geomLine);
            this.projectedCircles_objects.push(line);

            scene.add(line);
            render();
        }

    }
}

window.onload = function() {
    init();
    animate();
};


function initGui() {

    gui = new GUI();

    globalOptions = gui.addFolder('Global Controls');
    var param = {
        'Fiber resolution': 250,
        'Map R3 to B3': true,
    };
    globalOptions.add( param, 'Fiber resolution', 10,500,10 ).onChange( function ( val ) {
        fiberResolution = val;
        for (var index in baseSpaceCircles)
            baseSpaceCircles[index].updateFiberProjections();
    } );
    globalOptions.add( param, 'Map R3 to B3' ).onChange( function ( val ) {
        compressToBall = val;
        for (var index in baseSpaceCircles)
            baseSpaceCircles[index].updateFiberProjections();
    } );

    baseSpaceOptions = gui.addFolder("Base Space Parametrization");
    var paramBaseSpace = {
        'Center offset': 0,
        'Circumference': 2*Math.PI,
        'Point count': 10,
        'X-component': 0.0,
        'Y-component': 0.0,
        'Z-component': 0.0,
        'Angle': 0.0,
        'Detach': function() {
            baseSpaceCircles.push(new baseSpaceCircle(0, Math.PI*2, 10, defaultRotation, new THREE.Vector3(0,0,0).normalize(), 0.0));
            baseSpaceOptions.__controllers.forEach(controller => controller.setValue(controller.initialValue));
            appliedRotation.__controllers.forEach(controller => controller.setValue(controller.initialValue));
          },
          'Clear all': function() {
            for (var index in baseSpaceCircles)
            baseSpaceCircles[index].destroy();
            baseSpaceCircles = [];
            baseSpaceCircles.push(new baseSpaceCircle(0, Math.PI*2, 10, defaultRotation, new THREE.Vector3(0,0,0).normalize(), 0.0));
            baseSpaceOptions.__controllers.forEach(controller => controller.setValue(controller.initialValue));
            appliedRotation.__controllers.forEach(controller => controller.setValue(controller.initialValue));
          }
    }
    baseSpaceOptions.add( paramBaseSpace, 'Center offset', -1, 1, 0.0001).onChange( function(val) {
        var index = baseSpaceCircles.length-1;
        var pointCount = baseSpaceCircles[index].pointCount;
        var defaultRotation = baseSpaceCircles[index].defaultRotation;
        var circumference = baseSpaceCircles[index].circumference;
        var appliedRotation_axis = baseSpaceCircles[index].appliedRotation_axis;
        var appliedRotation_angle = baseSpaceCircles[index].appliedRotation_angle;
        baseSpaceCircles.pop().destroy();
        baseSpaceCircles.push(new baseSpaceCircle(val, circumference, pointCount, defaultRotation, appliedRotation_axis.normalize(), appliedRotation_angle));
    });

    baseSpaceOptions.add( paramBaseSpace, 'Circumference', 0, 2*Math.PI, 0.01).onChange( function(val) {
        var index = baseSpaceCircles.length-1;
        var pointCount = baseSpaceCircles[index].pointCount;
        var defaultRotation = baseSpaceCircles[index].defaultRotation;
        var distanceToCenter = baseSpaceCircles[index].distanceToCenter;
        var appliedRotation_axis = baseSpaceCircles[index].appliedRotation_axis;
        var appliedRotation_angle = baseSpaceCircles[index].appliedRotation_angle;
        baseSpaceCircles.pop().destroy();
        baseSpaceCircles.push(new baseSpaceCircle(distanceToCenter, val, pointCount, defaultRotation, appliedRotation_axis.normalize(), appliedRotation_angle));
    });

    baseSpaceOptions.add( paramBaseSpace, 'Point count', 1, 250, 1).onChange( function(val) {
        var index = baseSpaceCircles.length-1;
        var circumference = baseSpaceCircles[index].circumference;
        var defaultRotation = baseSpaceCircles[index].defaultRotation;
        var distanceToCenter = baseSpaceCircles[index].distanceToCenter;
        var appliedRotation_axis = baseSpaceCircles[index].appliedRotation_axis;
        var appliedRotation_angle = baseSpaceCircles[index].appliedRotation_angle;
        baseSpaceCircles.pop().destroy();
        baseSpaceCircles.push(new baseSpaceCircle(distanceToCenter, circumference, val, defaultRotation, appliedRotation_axis.normalize(), appliedRotation_angle));
    });

    appliedRotation = baseSpaceOptions.addFolder('Applied Rotation Quaternion');
    appliedRotation.add( paramBaseSpace, 'X-component', 0.0, 1, 0.1).onChange( function(val) {
        baseSpaceCircles[baseSpaceCircles.length-1].appliedRotation_axis.x = val;
        baseSpaceCircles[baseSpaceCircles.length-1].setAppliedRotation();
    });
    appliedRotation.add( paramBaseSpace, 'Y-component', 0.0, 1, 0.1).onChange( function(val) {
        baseSpaceCircles[baseSpaceCircles.length-1].appliedRotation_axis.y = val;
        baseSpaceCircles[baseSpaceCircles.length-1].setAppliedRotation();
    });
    appliedRotation.add( paramBaseSpace, 'Z-component', 0.0, 1, 0.1).onChange( function(val) {
        baseSpaceCircles[baseSpaceCircles.length-1].appliedRotation_axis.z = val;
        baseSpaceCircles[baseSpaceCircles.length-1].setAppliedRotation();
    });
    appliedRotation.add( paramBaseSpace, 'Angle', 0.0, 0.1, 0.0001).onChange( function(val) {
        baseSpaceCircles[baseSpaceCircles.length-1].appliedRotation_angle = val;
        baseSpaceCircles[baseSpaceCircles.length-1].setAppliedRotation();
    });

    baseSpaceOptions.add(paramBaseSpace, 'Detach');
    baseSpaceOptions.add(paramBaseSpace, 'Clear all');
}

function init() {

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 1000);
    camera.position.x = -3;
    camera.position.y = 0;
    camera.position.z = 0;
    camera.lookAt(0,0,0);

    // Orthographic camera, to focus on the 2-sphere base space
    var aspect = window.innerWidth / window.innerHeight;
    var scale = 3;
    //orthCamera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 0.001, 1000);
    orthCamera = new THREE.OrthographicCamera(-aspect*scale, aspect*scale, 1*scale, -1*scale, 0.001, 1000);
    orthCamera.position.set(5,5,10);
    orthCamera.lookAt(0,0,0);

    // Scene for fiber projections
    scene = new THREE.Scene();

    // Scene for the 2-sphere base space
    orthScene = new THREE.Scene();

    // Objects
    baseSpace_geometry = new THREE.SphereGeometry(1,30,30);
    baseSpace_material = new THREE.MeshBasicMaterial({color: 0xfafafa});
    baseSpace_material.transparent = true;
    baseSpace_material.opacity = 0.5;
    baseSpace = new THREE.Mesh(baseSpace_geometry,baseSpace_material);
    baseSpace.position.x = 4.5;
    baseSpace.position.y = -1;
    orthScene.add(baseSpace);

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth , window.innerHeight );
    renderer.autoClear = false;

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
    document.body.appendChild(renderer.domElement);

    stats = new Stats();
    document.body.appendChild(stats.dom);

    initGui();

    baseSpaceCircles.push(new baseSpaceCircle(0, 2*Math.PI, 10, defaultRotation, new THREE.Vector3(0,0,0), 0.0));

    onWindowResize();
    render();
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight ;
    var aspect = window.innerWidth / window.innerHeight;
    var scale = 3;
    orthCamera.left = -aspect*scale;
    orthCamera.right = aspect*scale;
    orthCamera.top = 1*scale;
    orthCamera.bottom = -1*scale;
    baseSpace.position.x = 4.5 + 4*(window.innerWidth - 1920)/1920;
    orthCamera.updateProjectionMatrix();
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    stats.update();

    for (var index in baseSpaceCircles) {
        baseSpaceCircles[index].rotate();
        if (baseSpaceCircles[index].appliedRotation_angle > 0)
            baseSpaceCircles[index].updateFiberProjections();

        baseSpaceCircles[index].base_object.position.x = 4.5 + 4*(window.innerWidth - 1920)/1920;
        baseSpaceCircles[index].base_object.position.y = -1;
    }

    render();
}

function render() {
    renderer.clear();
    renderer.render(scene,camera);
    renderer.clearDepth();
    renderer.render(orthScene, orthCamera);
}
