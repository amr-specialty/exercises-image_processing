function initGL(canvas) {
    var gl;

    try {
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
    } catch (e) {
        alert(e);
    }
    
    if (!gl) {
        alert("Failed to initialize WebGL!");
    }

    return gl;
}
    
function getShader(gl, id, type) {
    var script = document.getElementById(id);
    
    if (!script) {
        alert("Could not find script: " + id);
        return null;
    }

    var shader = gl.createShader(type);
    
    gl.shaderSource(shader, script.value);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

function initShaders(gl, vs, fs) {
    var fragmentShader = getShader(gl, fs, gl.FRAGMENT_SHADER);
    var vertexShader = getShader(gl, vs, gl.VERTEX_SHADER);
    var program = gl.createProgram();
    
    if (!fragmentShader || !vertexShader) {
        return null;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not initialize program!");
        gl.deleteProgram(program);
        return null;
    }
    
    gl.detachShader(program, fragmentShader);
    gl.detachShader(program, vertexShader);
    
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    program.attribs = {};        
    program.attribs.vPos = gl.getAttribLocation(program, "vPos");
    program.attribs.vUVs = gl.getAttribLocation(program, "vUVs");
    
    program.uniforms = {};
    program.uniforms.uMvp = gl.getUniformLocation(program, "uMvp");
    program.uniforms.uImage = gl.getUniformLocation(program, "uImage");                
    
    if (program.uniforms.uMvp) {
        program.uniforms.uMvp.set = function(mat) {
            gl.useProgram(program);
            gl.uniformMatrix4fv(program.uniforms.uMvp, false, mat);
        };
    } else {
        program.uniforms.uMvp = {};
        program.uniforms.uMvp.set = function(mat) {};
    }
    
    if (program.uniforms.uImage) {
        program.uniforms.uImage.set = function(imgBinding) {
            gl.useProgram(program);
            gl.uniform1i(program.uniforms.uImage, imgBinding);
        };
    } else {
        program.uniforms.uImage = {};
        program.uniforms.uImage.set = function(imgBinding) {};
    }
    
    program.use = function() {
        gl.useProgram(program);
    };
    
    program.free = function() {
        gl.deleteProgram(program);
        program.uniforms = null;
        program.attribs = null;
    };
    
    return program;
}    

function initTexture(gl, imgLoc) {
    var texture = gl.createTexture();
    
    texture.image = new Image();
    texture.ready = false;

    texture.image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texture.image);
        gl.bindTexture(gl.TEXTURE_2D, null);
        texture.ready = true;
    };
    
    texture.bind = function(binding) {
        if (texture.ready) {
            gl.activeTexture(gl.TEXTURE0 + binding);
            gl.bindTexture(gl.TEXTURE_2D, texture);
        } else {
            console.log("Unable to bind texture!");
        }
    };
    
    texture.image.src = imgLoc;

    return texture;
}

function initBuffers(gl) {
    var vPos = gl.createBuffer();

    {
        var vertices = [
            -1.0, -1.0,
            -1.0, 1.0,
            1.0, -1.0,
            1.0, 1.0];

        gl.bindBuffer(gl.ARRAY_BUFFER, vPos);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);                
    }
    
    var vUVs = gl.createBuffer();
    
    {
        var uvs = [
            0.0, 0.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0];
            
        gl.bindBuffer(gl.ARRAY_BUFFER, vUVs);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    
    var model = {};
    
    model.attribs = {};
    model.attribs.vPos = vPos;
    model.attribs.vUVs = vUVs;
    model.draw = function(vPosLoc, vUVsLoc) {
        if (vPosLoc != -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, model.attribs.vPos);
            gl.enableVertexAttribArray(vPosLoc);
            gl.vertexAttribPointer(vPosLoc, 2, gl.FLOAT, false, 0, 0);
        }
        
        if (vUVsLoc != -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, model.attribs.vUVs);
            gl.enableVertexAttribArray(vUVsLoc);
            gl.vertexAttribPointer(vUVsLoc, 2, gl.FLOAT, false, 0, 0);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        if (vUVsLoc != -1) {
            gl.disableVertexAttribArray(vUVsLoc);
        }
        
        if (vPosLoc != -1) {
            gl.disableVertexAttribArray(vPosLoc);
        }
    };
    
    return model;
}

function drawScene(gl, processProgram, model, baseImage) {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (!baseImage.ready) {
        return;
    }
        
    baseImage.bind(0);
    
    if (!processProgram) {
        return;
    }
    
    processProgram.use();
    
    var mIdentity = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0];
                
    processProgram.uniforms.uMvp.set(new Float32Array(mIdentity));
    processProgram.uniforms.uImage.set(0);
    
    model.draw(processProgram.attribs.vPos, processProgram.attribs.vUVs);
}

// from webgl-util.js
/**
 * Provides requestAnimationFrame in a cross browser way.
 */
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
           window.setTimeout(callback, 1000/60);
         };
    })();
    
var programNeedsReload = false;

function triggerProgramReload() {
    programNeedsReload = true;
}

function triggerProgramReset() {
    var src = document.getElementById("originalFragmentCode");
    var dst = document.getElementById("fragmentCode");
    
    dst.value = src.value;
    programNeedsReload = true;
}

function webglStart() {
    var vertexName = "vertexCode";
    var fragmentName = "fragmentCode";
    var canvas = document.getElementById("canvas");
    var gl = initGL(canvas);    
    var processProgram = initShaders(gl, vertexName, fragmentName);
    var model = initBuffers(gl);
    var baseImage = initTexture(gl, "base.png");
    
    var update = function() {
        if (programNeedsReload) {
            if (processProgram) {
                processProgram.free();
            }
            
            processProgram = initShaders(gl, vertexName, fragmentName);
            programNeedsReload = false;
        }
    
        requestAnimFrame(update);
        drawScene(gl, processProgram, model, baseImage);            
    };
    
    update();
}
