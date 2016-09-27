//23456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
//
// PointLightedSphere_perFragment.js (c) 2012 matsuda and kanda
// MODIFIED for EECS 351-1, Northwestern Univ. Jack Tumblin:
//
//    Completed the Blinn-Phong lighting model: add emissive and specular:
//    --Ke, Ka, Kd, Ks: K==Reflectance; emissive, ambient, diffuse, specular.
//    --Kshiny: specular exponent for 'shinyness'.
//    --Ia, Id, Is:   I==Illumination:          ambient, diffuse, specular.
//    -- Implemented Blinn-Phong 'half-angle' specular term (from class)
//
//  JTSecondLight_perFragment.js:
//  Version 01: Same as JTPointBlinnPhongSphere_perFragment.js
//  Version 02: add mouse, keyboard callbacks with on-screen display.
//  Version 03: add 'draw()' function (ugly!) to call whenever we need to 
//              re-draw the screen (e.g. after mouse-drag). Convert all 'handles'
//              for GPU storage locations (supplied by gl.getUniformLocation() 
//              to GLOBAL vars to prevent large argument lists for the draw() 
//              fcn.  Apply K_shiny uniform in GLSL using pow() fcn; test it
//              with K_shiny values of 10 and 100.
//  Version 04: eliminate arguments to 'draw()' function by converting them to
//              'global' variables; then we can call 'draw()' from any fcn.  
//              In keypress() fcn, make s/S keys decrease/increase K_shiny by 1
//              and call the 'draw()' function to show result on-screen. 
//              Add JavaScript global variables for existing lamp0 uniforms;
//              (Temporarily) use mouse-drag to modify lamp0 position & redraw;
//              and make 'clear' button re-set the lamp0 position.
//              Note how AWKWARDLY mouse-dragging moved the light: can we fix it?
//  Version 05: YES! first, lets' understand what we see on-screen:
//            --Prev. versions set Camera position to (6,0,0) in world coords,  
//              (eyeWorldPos[] value set in main()), aimed at origin, 'up'==+z.
//              THUS camera's x,y axes are aligned with world-space y,z axes! 
//            --Prev. versions set lamp0Pos[] to world coords (6,6,0) in main(),
//              thus it's on-screen location is center-right.  Our mouseDrag() 
//              code causes left/right drag to adjust lamp0 +/-x in world space, 
//              (towards/away from camera), and up/down drag adjusts lamp0 +/-y 
//              (left/right on-screen). No wonder the result looks weird!
//              FIX IT: change mouseDrag() to map x,y drags to lamp0 y,z values
//                instead of x,y.  We will keep x value fixed at +6, so that
//                mouse-drags move lamp0 in the same yz plane as the camera.
//                ALSO -- change lamp0 position to better-looking (6,5,5). 
//                (don't forget HTML button handler 'clearDrag()' fcn below).
//        PUZZLE:  What limits specular highlight to 45deg from world +x axis? 
//                 How could you fix that?
//  Version 06: create GLSL struct & prove it works in Vertex Shader; then
//              make a 'LampT' struct uniform.  


  // Vertex shader program
  var VSHADER_SOURCE =
  //-------------Set precision.
  // GLSL-ES 2.0 defaults (from spec; '4.5.3 Default Precision Qualifiers'):
  // DEFAULT for Vertex Shaders:  precision highp float; precision highp int;
  //                  precision lowp sampler2D; precision lowp samplerCube;
  // DEFAULT for Fragment Shaders:  UNDEFINED for float; precision mediump int;
  //                  precision lowp sampler2D; precision lowp samplerCube;
                                    
  //-------------ATTRIBUTES: of each vertex, read from our Vertex Buffer Object
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  'precision mediump int;\n' +
  '#endif\n' +

  'attribute vec4 a_Position; \n' +
  'attribute vec4 a_Normal; \n' +
  'uniform mat4 u_MvpMatrix; \n' +
  'uniform mat4 u_ModelMatrix; \n' +
  'uniform mat4 u_NormalMatrix; \n' +
  'varying vec4 v_Position; \n' +       
  'varying vec3 v_Normal; \n' +

  'uniform vec3 u_Kd; \n' +
  'varying vec3 v_Kd; \n' +
  'uniform vec3 u_Ks;\n' +
   'uniform vec3 u_Ka;\n' +
    'uniform vec3 u_Ke;\n' +
  'uniform int u_Kshiny;\n' +

  'uniform int u_ShadeMod;\n' +
  'uniform int u_LightMod;\n' +

  'uniform int ATT;\n' +

  'float specTmp1; \n' +
  'float specTmp2; \n' +
  
  'float att1; \n' +
  'float att2; \n' +


  'uniform vec4 u_eyePosWorld; \n' +
  'varying vec4 v_Color; \n' +

  'struct Lamp{ \n'+
  'vec3 u_LampPos;\n' +
  'vec3 u_LampAmb;\n' +
  'vec3 u_LampDiff;\n' +
  'vec3 u_LampSpec;\n' +
  '};\n'+
  'uniform Lamp Lamp1;\n'+
  'uniform Lamp Lamp2;\n'+
  //------------------------END struct definition



  'void main() { \n' +
  'if (u_ShadeMod == 1) {\n' +
  'gl_Position = u_MvpMatrix * a_Position;\n' +
    // Calculate the vertex position & normal in the world coordinate system
    // and then save a 'varying', so that fragment shader will get per-pixel
    // values (interpolated between vertices of our drawing prim. (triangle).
  'v_Position = u_ModelMatrix * a_Position;\n' +
  'v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  'vec3 normal = normalize(v_Normal);\n' +
  'vec3 lightDirection1 = normalize(Lamp1.u_LampPos.xyz - v_Position.xyz);\n' +
  'vec3 lightDirection2 = normalize(Lamp2.u_LampPos.xyz - v_Position.xyz);\n' +
  'vec3 eyeDirection = normalize(u_eyePosWorld.xyz - v_Position.xyz); \n' +
  'float nDotL1 = max(dot(lightDirection1, normal), 0.0); \n' +
  'float nDotHead = max(dot(lightDirection2, normal), 0.0); \n' +

  'float dist1 = length(Lamp1.u_LampPos.xyz - v_Position.xyz);\n' +
  'float dist2 = length(Lamp2.u_LampPos.xyz - v_Position.xyz);\n' +

  'if (ATT == 0) {\n' + 
  ' att1 = 1.0;\n' +
  ' att2 = 1.0;\n' +
  '};\n' +

  'if (ATT == 1) {\n' +
  ' att1 = 1.0 / (1.0 + 0.1 * dist1);\n' +
  ' att2 = 1.0 / (1.0 + 0.1 * dist2);\n' +
  '};\n' +

  'if (ATT == 2) {\n' +
  ' att1 = 1.0 / (1.0 + 0.1 * 0.1 * dist1 * dist1);\n' +
  ' att2 = 1.0 / (1.0 + 0.1 * 0.1 * dist2 * dist2);\n' +
  '};\n' +

  'vec3 diffuse = (Lamp1.u_LampDiff * nDotL1 * att1 + Lamp2.u_LampDiff * nDotHead *att2) * u_Kd;\n' +
  'vec3 emissive = u_Ke;\n' +
  'vec3 ambient = (Lamp1.u_LampAmb + Lamp2.u_LampAmb) * u_Ka;\n' +

  'if (u_LightMod == 0) { \n' +
  'vec3 reflectionVector1 = reflect(-lightDirection1, normal);\n' +
  'vec3 reflectionVector2 = reflect(-lightDirection2, normal);\n' +
  'specTmp1 = max(dot(reflectionVector1, eyeDirection), 0.0);\n' +
  'specTmp2 = max(dot(reflectionVector2, eyeDirection), 0.0);\n' +
  '}\n' +
  'else{\n' +
  'vec3 H1 = normalize(lightDirection1 + eyeDirection); \n' +
  'vec3 H2 = normalize(lightDirection2 + eyeDirection); \n' +
  'specTmp1 = max(dot(H1, normal), 0.0); \n' +
  'specTmp2 = max(dot(H2, normal), 0.0); \n' +
  '}\n' +

  'float nDotH1pK = pow(specTmp1, float(u_Kshiny));\n' +
  'float nDotH2pK = pow(specTmp2, float(u_Kshiny));\n' +

  'vec3 speculr = (Lamp1.u_LampSpec * nDotH1pK + Lamp2.u_LampSpec * nDotH2pK) * u_Ks;\n' +

  'v_Color =  vec4(emissive + ambient + diffuse + speculr,1.0);\n'+
  '} \n' +

  'else{\n' +
  'gl_Position = u_MvpMatrix * a_Position;\n' +
  'v_Position = u_ModelMatrix * a_Position; \n' +
  'v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  'v_Kd = u_Kd; \n' +
  '};\n' +


  '}\n';


// Fragment shader program
  var FSHADER_SOURCE =
  //-------------Set precision.
  // GLSL-ES 2.0 defaults (from spec; '4.5.3 Default Precision Qualifiers'):
  // DEFAULT for Vertex Shaders:  precision highp float; precision highp int;
  //                  precision lowp sampler2D; precision lowp samplerCube;
  // DEFAULT for Fragment Shaders:  UNDEFINED for float; precision mediump int;
  //                  precision lowp sampler2D; precision lowp samplerCube;
  // MATCH the Vertex shader precision for float and int:
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  'precision mediump int;\n' +
  '#endif\n' +

  'struct Lamp{ \n'+
  'vec3 u_LampPos;\n' +
  'vec3 u_LampAmb;\n' +
  'vec3 u_LampDiff;\n' +
  'vec3 u_LampSpec;\n' +
  '};\n'+

  'uniform Lamp Lamp1;\n'+
  'uniform Lamp Lamp2;\n'+

  'uniform vec3 u_Ke;\n' +
  'uniform vec3 u_Ka;\n' +
  'uniform vec3 u_Ks;\n' +
  'uniform int u_Kshiny;\n' +
  'uniform int u_LightMod;\n' +
  'uniform int u_ShadeMod;\n' +

  'uniform int ATT;\n' +

  'float att1; \n' +
  'float att2; \n' +

  'float specTmp1; \n' +
  'float specTmp2; \n' +

  'uniform vec4 u_eyePosWorld; \n' +
  
  'varying vec3 v_Normal;\n' +
  'varying vec4 v_Position;\n' +
  'varying vec3 v_Kd; \n' +

  'varying vec4 v_Color;\n'+



  'void main() { \n' +

  'if (u_ShadeMod == 1) {\n' +
  'gl_FragColor = v_Color;\n' +

  '} \n' +
  'else{\n' +
  // Normalize the normal because it is interpolated and not 1.0 in length any more
  'vec3 normal = normalize(v_Normal); \n' +
   // Calculate the light direction and make it 1.0 in length
  'vec3 lightDirection1 = normalize(Lamp1.u_LampPos.xyz - v_Position.xyz);\n' +
  'vec3 lightDirection2 = normalize(Lamp2.u_LampPos.xyz - v_Position.xyz);\n' +
    // The dot product of the light direction and the normal
  'float nDotL1 = max(dot(lightDirection1, normal), 0.0); \n' +
  'float nDotHead = max(dot(lightDirection2, normal), 0.0); \n' +
  'vec3 eyeDirection = normalize(u_eyePosWorld.xyz - v_Position.xyz); \n' +

  'if (u_LightMod == 0) { \n' +
  'vec3 reflectionVector1 = reflect(-lightDirection1, normal);\n' +
  'vec3 reflectionVector2 = reflect(-lightDirection2, normal);\n' +
  'specTmp1 = max(dot(reflectionVector1, eyeDirection), 0.0);\n' +
  'specTmp2 = max(dot(reflectionVector2, eyeDirection), 0.0);\n' +
  '}\n' +

  'else{\n' +
  'vec3 H1 = normalize(lightDirection1 + eyeDirection); \n' +
  'vec3 H2 = normalize(lightDirection2 + eyeDirection); \n' +
  'specTmp1 = max(dot(H1, normal), 0.0); \n' +
  'specTmp2 = max(dot(H2, normal), 0.0); \n' +
  '}\n' +

  'float nDotH1pK = pow(specTmp1, float(u_Kshiny));\n' +
  'float nDotH2pK = pow(specTmp2, float(u_Kshiny));\n' +
  

  'float dist1 = length(Lamp1.u_LampPos.xyz - v_Position.xyz);\n' +
  'float dist2 = length(Lamp2.u_LampPos.xyz - v_Position.xyz);\n' +

  'if (ATT == 0) {\n' + 
  ' att1 = 1.0;\n' +
  ' att2 = 1.0;\n' +
  '};\n' +

  'if (ATT == 1) {\n' +
  ' att1 = 1.0 / (1.0 + 0.1 * dist1);\n' +
  ' att2 = 1.0 / (1.0 + 0.1 * dist2);\n' +
  '};\n' +

  'if (ATT == 2) {\n' +
  ' att1 = 1.0 / (1.0 + 0.1 * 0.1 * dist1 * dist1);\n' +
  ' att2 = 1.0 / (1.0 + 0.1 * 0.1 * dist2 * dist2);\n' +
  '};\n' +

// Calculate the final color from diffuse reflection and ambient reflection
  'vec3 emissive = u_Ke;\n' +
  'vec3 ambient = (Lamp1.u_LampAmb + Lamp2.u_LampAmb) * u_Ka;\n' +
  'vec3 diffuse = (Lamp1.u_LampDiff * nDotL1 * att1 + Lamp2.u_LampDiff * nDotHead * att2) * v_Kd;\n' +
  'vec3 speculr = (Lamp1.u_LampSpec * nDotH1pK + Lamp2.u_LampSpec * nDotH2pK) * u_Ks;\n' +
  'gl_FragColor = vec4(emissive + ambient + diffuse + speculr, 1.0);\n' +
  '};\n' +

  '}\n';

 

  var u_ModelMatrix;
  var u_MvpMatrix;
  var u_NormalMatrix;
  var u_eyePosWorld;
  var modelMatrix;
  var mvpMatrix;
  var normalMatrix;

  var worldlightSign = 0;
  var headlightSign = 0;
  var lightingSign = 0;
  var shadingSign = 0;

  var ATT;
  var adist=0;

  var theta1 = 0;
  var theta2 = 0;
 
  var ANGLE_STEP = 65.0;
  var currentAngle = 0.0;
  var g_EyeX = -8.0, g_EyeY = -10.0, g_EyeZ = 2.0; 
  var g_LookAtX = g_EyeX + Math.sin(theta1);
  var g_LookAtY = g_EyeY +  Math.cos(theta1);
  var g_LookAtZ = 2.0;

  var u_LightMod;
  var u_ShadeMod;

  var Head_x = 2;
  var Head_y = -5;
  var Head_z = 4;

  var Head_AR = 0.5;
  var Head_AG = 0.5;
  var Head_AB = 0.5;

  var Head_DR = 1.0;
  var Head_DG = 1.0;
  var Head_DB = 1.0;

  var Head_SR = 0.7;
  var Head_SG = 0.7;
  var Head_SB = 0.7;

  var u_Ke, u_Ka, u_Kd, u_Ks;
  var myMaterial;
  var MATL_RED_PLASTIC = 1;
  var MATL_GRN_PLASTIC = 2;
  var MATL_BLU_PLASTIC = 3;
  var MATL_BLACK_PLASTIC = 4;
  var MATL_BLACK_RUBBER = 5;
  var MATL_BRASS = 6;
  var MATL_BRONZE_DULL = 7;
  var MATL_BRONZE_SHINY = 8;
  var MATL_CHROME = 9;
  var MATL_COPPER_DULL = 10;
  var MATL_COPPER_SHINY = 11;
  var MATL_GOLD_DULL = 12;
  var MATL_GOLD_SHINY = 13;
  var MATL_PEWTER = 14;
  var MATL_SILVER_DULL = 15;
  var MATL_SILVER_SHINY = 16;
  var MATL_EMERALD = 17;
  var MATL_JADE = 18;
  var MATL_OBSIDIAN = 19;
  var MATL_PEARL = 20;
  var MATL_RUBY = 21;
  var MATL_TURQUOISE = 22;
  var DEFAULT = 23;

  var floatsPerVertex = 3; // # of Float32Array elements used for each vertex
  var moveStep = 0.15;
  var lookStep = 0.02;
  var PHI_NOW = 0;
  var theta1_NOW = 0;
  var update = -1;

  var gl;
  var n;
  function Lamp(){
    this.u_LampPos;
    this.u_LampAmbi;
    this.u_LampDiff;
    this.u_LampSpec;
    this.lampPos  = new Float32Array(3);
    this.lampAmbi = new Float32Array(3);
    this.lampDiff = new Float32Array(3);
    this.lampSpec = new Float32Array(3);
  };
  var Lamp1 = new Lamp;
  var Lamp2 = new Lamp;

  function main() {
    // Retrieve <canvas> element
    var canvas = document.getElementById('webgl');
        canvas.width=window.innerWidth;
        canvas.height=window.innerHeight-100;

   // Get the rendering context for WebGL
     gl = getWebGLContext(canvas);
    if (!gl) {
      console.log('Failed to get the rendering context for WebGL');
      return;
    }
   // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
      console.log('Failed to intialize shaders.');
      return;
    }
  // NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
  // unless the new Z value is closer to the eye than the old one..
  //  gl.depthFunc(gl.LESS);   
    gl.enable(gl.DEPTH_TEST);
// Set the vertex coordinates and color (the blue triangle is in the front)
     n = initVertexBuffers(gl);
    if (n < 0) {
      console.log('Failed to set the vertex information');
      return;
    }
  

// Specify the color for clearing <canvas>
    gl.clearColor(0.13, 0.67, 0.8, 1);

// Get the storage locations of u_ViewMatrix and u_ProjMatrix variables
    u_eyePosWorld = gl.getUniformLocation(gl.program, 'u_eyePosWorld');
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_MvpMatrix = gl.getUniformLocation(gl.program,   'u_MvpMatrix');
    u_NormalMatrix = gl.getUniformLocation(gl.program,'u_NormalMatrix');
    if (!u_ModelMatrix  || !u_MvpMatrix || !u_NormalMatrix || !u_eyePosWorld) {
      console.log('Failed to get matrix storage locations');
      return;
    }

// Get the storage locations of lamp1 and lamp2
    Lamp1.u_LampPos  = gl.getUniformLocation(gl.program,'Lamp1.u_LampPos');
    Lamp1.u_LampAmb  = gl.getUniformLocation(gl.program,'Lamp1.u_LampAmb');
    Lamp1.u_LampDiff = gl.getUniformLocation(gl.program,'Lamp1.u_LampDiff');
    Lamp1.u_LampSpec = gl.getUniformLocation(gl.program,'Lamp1.u_LampSpec');
    if( !Lamp1.u_LampPos || !Lamp1.u_LampAmb || !Lamp1.u_LampDiff || !Lamp1.u_LampSpec) {
      console.log('Failed to get the Lamp1 storage locations');
      return;
    }

    Lamp2.u_LampPos  = gl.getUniformLocation(gl.program,'Lamp2.u_LampPos');
    Lamp2.u_LampAmb  = gl.getUniformLocation(gl.program,'Lamp2.u_LampAmb');
    Lamp2.u_LampDiff = gl.getUniformLocation(gl.program,'Lamp2.u_LampDiff');
    Lamp2.u_LampSpec = gl.getUniformLocation(gl.program,'Lamp2.u_LampSpec');
    if( !Lamp2.u_LampPos || !Lamp2.u_LampAmb || !Lamp2.u_LampDiff || !Lamp2.u_LampSpec) {
      console.log('Failed to get the Lamp2 storage locations');
      return;
    }

    u_Ke = gl.getUniformLocation(gl.program, 'u_Ke');
    u_Ka = gl.getUniformLocation(gl.program, 'u_Ka');
    u_Kd = gl.getUniformLocation(gl.program, 'u_Kd');
    u_Ks = gl.getUniformLocation(gl.program, 'u_Ks');
    u_Kshiny = gl.getUniformLocation(gl.program, 'u_Kshiny');
    u_LightMod = gl.getUniformLocation(gl.program, 'u_LightMod');
    u_ShadeMod = gl.getUniformLocation(gl.program, 'u_ShadeMod');

    ATT = gl.getUniformLocation(gl.program, 'ATT');

    if(!u_Ke || !u_Ka || !u_Kd || !u_Ks || !u_Kshiny || !u_LightMod) {
      console.log('Failed to get the Phong Reflectance storage locations');
      return;
    }

    Lamp1.lampPos.set([g_EyeX, g_EyeY, g_EyeZ]);
    Lamp1.lampAmbi.set([1.0, 1.0, 1.0]);
    Lamp1.lampDiff.set([1.0, 1.0, 1.0]);
    Lamp1.lampSpec.set([1.0, 1.0, 1.0]);
    setLamp(Lamp1);

    Lamp2.lampPos.set([Head_x, Head_y, Head_z]);
    Lamp2.lampAmbi.set([Head_AR, Head_AG, Head_AB]);
    Lamp2.lampDiff.set([Head_DR, Head_DG, Head_DB]);
    Lamp2.lampSpec.set([Head_SR, Head_SG, Head_SB]);
    setLamp(Lamp2);

    modelMatrix = new Matrix4();
    mvpMatrix = new Matrix4();
    normalMatrix = new Matrix4();

    resize();

    document.onkeydown = function(ev){ keydown(ev); };
    var tick = function() {

      if (headlightSign %2 ) {
        Lamp1.lampAmbi.set([0.0, 0.0, 0.0]);//world light on and off
        Lamp1.lampDiff.set([0.0, 0.0, 0.0]);
        Lamp1.lampSpec.set([0.0, 0.0, 0.0]);
        setLamp(Lamp1);
      } 
      else{
        Lamp1.lampAmbi.set([1.0, 1.0, 1.0]);
        Lamp1.lampDiff.set([1.0, 1.0, 1.0]);
        Lamp1.lampSpec.set([1.0, 1.0, 1.0]);
        setLamp(Lamp1);
      }

      if (worldlightSign %2 ) {
        Lamp2.lampAmbi.set([0.0, 0.0, 0.0]);//head light on and off
        Lamp2.lampDiff.set([0.0, 0.0, 0.0]);
        Lamp2.lampSpec.set([0.0, 0.0, 0.0]);
        setLamp(Lamp2);
      } 
      else{
        Lamp2.lampPos.set([Head_x, Head_y, Head_z]);
        Lamp2.lampAmbi.set([Head_AR, Head_AG, Head_AB]);
        Lamp2.lampDiff.set([Head_DR, Head_DG, Head_DB]);
        Lamp2.lampSpec.set([Head_SR, Head_SG, Head_SB]);
        setLamp(Lamp2);
      }

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      currentAngle = animate(currentAngle); // Update the rotation angle
      draw(gl, canvas);
      requestAnimationFrame(tick, canvas);   // Request that the browser re-draw the webpage

    };

    tick();
  }


  function makeGroundGrid() {

    gndVerts1 = new Float32Array(3*101);

    gndVerts1[0] = -50;
    gndVerts1[1] =   0;
    gndVerts1[2] =   0;
    for (var j=1; j < 50; j++) {
      gndVerts1[6*(j-1)+3    ] = -50 + (j-1) * 5;
      gndVerts1[6*(j-1)+3  +1] = 5;
      gndVerts1[6*(j-1)+3  +2] = 6* (Math.sin(j/10 * 2 * Math.PI))^2;        

      gndVerts1[6*j    ] = -50 + j * 5;
      gndVerts1[6*j  +1] = 0;
      gndVerts1[6*j  +2] = 0;      
    };

    gndVerts2 = new Float32Array(3*101);

    gndVerts2[0] = -50;
    gndVerts2[1] =  10;
    gndVerts2[2] =   0;
    for (var j=1; j < 50; j++) {
      gndVerts2[6*(j-1)+3    ] = -50 + (j-1) * 5;
      gndVerts2[6*(j-1)+3  +1] = 5;
      gndVerts2[6*(j-1)+3  +2] = 6* (Math.sin(j/10 * 2 * Math.PI))^2;        

      gndVerts2[6*j    ] = -50 + j * 5;
      gndVerts2[6*j  +1] = 10;
      gndVerts2[6*j  +2] = 0;      
    };

  }


function makeTri() {
triVerts = new Float32Array([
  
    // Face 0
     0.00, 0.00, 1.00, 
     0.00, 2.00, 2.00, 
     0.87, 2.00, 0.50, 
      // Face 1(front)
     0.00, 0.00, 1.00, 
     0.87, 2.00, 0.50, 
    -0.87, 2.00, 0.50, 
      // Face 2
     0.00, 0.00, 1.00, 
    -0.87, 2.00, 0.50, 
     0.00, 2.00, 2.00, 
      // Face 3  
    -0.87, 2.00, 0.50, 
     0.87, 2.00, 0.50,
     0.00, 2.00, 2.00, 
  ]);

}


function makeStar() {
 starVerts = new Float32Array([
    0.00,  0.0,  1.0, // v0 
   -0.29,  0.5,  0.0, // v2 
   -0.83,  0.5,  0.0,  // v1

    0.00,  0.0,  1.0, // v0 
   -0.83,  0.5,  0.0, // v1 
   -0.56,  0.0,  0.0,   // v12 

    0.00,  0.0,  1.0, // v0 
   -0.56,  0.0,  0.0, // v12
   -0.83, -0.5,  0.0, // v11

    0.00,  0.0,  1.0,  // v0 
   -0.83, -0.5,  0.0, // v11
   -0.29, -0.5,  0.0, // v10

    0.00,  0.0,  1.0, // v0 
   -0.29, -0.5,  0.0,  // v10
    0.00, -1.0,  0.0,// v9

    0.00,  0.0,  1.0,// v0 
    0.00, -1.0,  0.0,// v9
    0.29, -0.5,  0.0,  // v8

    0.00,  0.0,  1.0, // v0 
    0.29, -0.5,  0.0,  // v8
    0.83, -0.5,  0.0, // v7

    0.00,  0.0,  1.0, // v0
    0.83, -0.5,  0.0, // v7
    0.56,  0.0,  0.0,  // v6 

    0.00,  0.0,  1.0,// v0 
    0.56,  0.0,  0.0,// v6
    0.83,  0.5,  0.0, // v5 

    0.00,  0.0,  1.0,  // v0 
    0.83,  0.5,  0.0, // v5 
    0.29,  0.5,  0.0,  // v4 

    0.00,  0.0,  1.0,  // v0 
    0.29,  0.5,  0.0,  // v4 
    0.00,  1.0,  0.0, // v3 

    0.00,  0.0,  1.0,// v0 
    0.00,  1.0,  0.0,   // v3 
   -0.29,  0.5,  0.0, // v2

   -0.29,  0.5,  0.0, // v2 
    0.00,  1.0,  0.0,   // v3
    0.00,  0.0, -1.0,  // v13

    0.00,  1.0,  0.0,   // v3 
    0.29,  0.5,  0.0,  // v4
    0.00,  0.0, -1.0,   // v13

    0.29,  0.5,  0.0,  // v4 
    0.83,  0.5,  0.0,  // v5
    0.00,  0.0, -1.0,  // v13

    0.83,  0.5,  0.0,  // v5 
    0.56,  0.0,  0.0,   // v6
    0.00,  0.0, -1.0,   // v13

    0.56,  0.0,  0.0, // v6 
    0.83, -0.5,  0.0,  // v7
    0.00,  0.0, -1.0,  // v13

    0.83, -0.5,  0.0,   // v7 
     0.29, -0.5,  0.0,  // v8 
    0.00,  0.0, -1.0,  // v13

    0.29, -0.5,  0.0,  // v8 
     0.00, -1.0,  0.0,   // v9 
    0.00,  0.0, -1.0,  // v13

    0.00, -1.0,  0.0,    // v9 
    -0.29, -0.5,  0.0,    // v10 
    0.00,  0.0, -1.0,  // v13

    -0.29, -0.5,  0.0,   // v10 
    -0.83, -0.5,  0.0, // v11 
    0.00,  0.0, -1.0,  // v13

    -0.83, -0.5,  0.0,    // v11 
    -0.56,  0.0,  0.0,    // v12
    0.00,  0.0, -1.0,   // v13

    -0.56,  0.0,  0.0,   // v12
    -0.83,  0.5,  0.0, // v1 
    0.00,  0.0, -1.0,  // v13

    -0.83,  0.5,  0.0,  // v1 
    -0.29,  0.5,  0.0, // v2
    0.00,  0.0, -1.0,  // v13
  ]);
} 

function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
 var capVerts = 16; // # of vertices around the topmost 'cap' of the shape
 var botRadius = 0.4;   // radius of bottom of cylinder (top always 1.0)
 var topRadius = 0.2;
 
 // Create a (global) array to hold this cylinder's vertices;
 cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
                    // # of vertices * # of elements needed to store them. 

  // Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
  // v counts vertices: j counts array elements (vertices * elements per vertex)
  for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {  
    // skip the first vertex--not needed.
    if(v%2==0)
    {       // put even# vertices at center of cylinder's top cap:
      cylVerts[j  ] = 0.0;      // x,y,z,w == 0,0,1,1
      cylVerts[j+1] = 1.0;  
      cylVerts[j+2] = 0.0; 

    }
    else {  // put odd# vertices around the top cap's outer edge;
            // x,y,z,w == cos(theta1),sin(theta1), 1.0, 1.0
            //          theta1 = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
      cylVerts[j  ] = topRadius*Math.cos(Math.PI*(v-1)/capVerts);     // x
      cylVerts[j+1] = 1.0     // y
      //  (Why not 2*PI? because 0 < =v < 2*capVerts, so we
      //   can simplify cos(2*PI * (v-1)/(2*capVerts))
      cylVerts[j+2] = topRadius*Math.sin(Math.PI*(v-1)/capVerts);;  // z
     
    }
  }
  // Create the cylinder side walls, made of 2*capVerts vertices.
  // v counts vertices within the wall; j continues to count array elements
  for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
    if(v%2==0)  // position all even# vertices along top cap:
    {   
        cylVerts[j  ] = topRadius*Math.cos(Math.PI*(v)/capVerts);   // x
        cylVerts[j+1] = 1,0   // y
        cylVerts[j+2] = topRadius*Math.sin(Math.PI*(v)/capVerts);;  // z
     
    }
    else    // position all odd# vertices along the bottom cap:
    {
        cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);   // x
        cylVerts[j+1] =-1.0 // y
        cylVerts[j+2] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);;  // z
     
    }
  }
  // Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
  // v counts the vertices in the cap; j continues to count array elements
  for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
    if(v%2==0) {  // position even #'d vertices around bot cap's outer edge
      cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);   // x
      cylVerts[j+1] =-1.0 // y
      cylVerts[j+2] = botRadius * Math.sin(Math.PI*(v)/capVerts);;  // z
   
    }
    else {        // position odd#'d vertices at center of the bottom cap:
      cylVerts[j  ] = 0.0;      // x,y,z,w == 0,0,-1,1
      cylVerts[j+1] =-1.0;  
      cylVerts[j+2] = 0.0; 

    }
  }
};

function normalCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
 var capVerts = 16; // # of vertices around the topmost 'cap' of the shape
 var botRadius = 0.4;   // radius of bottom of cylinder (top always 1.0)
 var topRadius = 0.2;
 
 // Create a (global) array to hold this cylinder's vertices;
 normalCyl = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
                    // # of vertices * # of elements needed to store them. 

  // Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
  // v counts vertices: j counts array elements (vertices * elements per vertex)
  for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {  
    // skip the first vertex--not needed.
    if(v%2==0)
    {       // put even# vertices at center of cylinder's top cap:
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1; 
    }
    else {  // put odd# vertices around the top cap's outer edge;
            // x,y,z,w == cos(theta1),sin(theta1), 1.0, 1.0
            //          theta1 = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1; 
    }
  }
  // Create the cylinder side walls, made of 2*capVerts vertices.
  // v counts vertices within the wall; j continues to count array elements
  for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
    if(v%2==0)  // position all even# vertices along top cap:
    {   
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1; 
    }
    else    // position all odd# vertices along the bottom cap:
    {
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1;  
    }
  }
  // Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
  // v counts the vertices in the cap; j continues to count array elements
  for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
    if(v%2==0) {  // position even #'d vertices around bot cap's outer edge
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1; 
    }
    else {        // position odd#'d vertices at center of the bottom cap:
      normalCyl[j] = 0;
      normalCyl[j+1] = 0;
      normalCyl[j+2] = 1; 
    }
  }
};

function initVertexBuffers(gl) {

 makeGroundGrid();
 makeTri();
 makeCylinder();
 normalCylinder(); 
 makeStar();

 var SPHERE_DIV = 13;
 var i, ai, si, ci;
 var j, aj, sj, cj;
 var p1, p2;
 var balls = [];
 var indices = [];
 for (j = 0; j <= SPHERE_DIV; j++) {
  aj = j * Math.PI / SPHERE_DIV;
  sj = Math.sin(aj);
  cj = Math.cos(aj);
  for (i = 0; i <= SPHERE_DIV; i++) {
   ai = i * 2 * Math.PI / SPHERE_DIV;
   si = Math.sin(ai);
   ci = Math.cos(ai);
   balls.push(si * sj);
   balls.push(cj);
   balls.push(ci * sj);
 }
}
ballspositions = new Float32Array(balls);

var positions = new Float32Array (ballspositions.length + gndVerts1.length + gndVerts2.length + triVerts.length+
                cylVerts.length + starVerts.length);
ballsstart = 0;
for(i=0,j=0; j< ballspositions.length; i++,j++) {
  positions[i] = ballspositions[j];
}
gndVertsstart1 = i;
for(j=0; j< gndVerts1.length; i++, j++) {
  positions[i] = gndVerts1[j];
}
gndVertsstart2 = i;
for(j=0; j< gndVerts2.length; i++, j++) {
  positions[i] = gndVerts2[j];
}
tristart = i;
for (j=0; j< triVerts.length; i++, j++) {
  positions[i] = triVerts[j];
}
cylstart = i;
for (j=0; j< cylVerts.length; i++, j++) {
  positions[i] = cylVerts[j];
}
starstart = i;
for (j=0; j< starVerts.length; i++, j++) {
  positions[i] = starVerts[j];
};

for (j = 0; j < SPHERE_DIV; j++) {
  for (i = 0; i < SPHERE_DIV; i++) {
   p1 = j * (SPHERE_DIV+1) + i;
   p2 = p1 + (SPHERE_DIV+1);
   indices.push(p1);
   indices.push(p2);
   indices.push(p1 + 1);
   indices.push(p1 + 1);
   indices.push(p2);
   indices.push(p2 + 1);
 }
}

var normalTri = new Float32Array([

  2.45, 1.414, 1,  2.45, 1.414, 1,  2.45, 1.414, 1,
  -2.45, 1.414, 1,  -2.45, 1.414, 1,  -2.45, 1.414, 1,
  0, -2*1.414, 1,  0, -2*1.414, 1,  0, -2*1.414, 1,
  0, 0, -1,      0, 0, -1,      0, 0, -1, 

  ]);

var normalGnd1 = new Float32Array([
  0,-14.6946,25,
  0,-14.6946,25,
  0,-14.6946,25,
  -9.08,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  9.08,-14.69,25,
  0,-14.69,25,
  14.69,0,25,
  0,0,25,
  14.69,14.69,25,
  0,14.69,25,
  9.08,23.78,25,
  0,23.78,25,
  0,23.78,25,
  0,23.78,25,
  -9.08,14.69,25,
  0,14.69,25,
  -14.69,0,25,
  0,-14.6946,25,
  0,-14.6946,25,
  0,-14.6946,25,
  -9.08,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  9.08,-14.69,25,
  0,-14.69,25,
  14.69,0,25,
  0,0,25,
  14.69,14.69,25,
  0,14.69,25,
  9.08,23.78,25,
  0,23.78,25,
  0,23.78,25,
  0,23.78,25,
  -9.08,14.69,25,
  0,14.69,25,
  -14.69,0,25,
  0,-14.6946,25,

  0,-14.6946,25,
  0,-14.6946,25,
  -9.08,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  9.08,-14.69,25,
  0,-14.69,25,
  14.69,0,25,
  0,0,25,
  14.69,14.69,25,
  0,14.69,25,
  9.08,23.78,25,
  0,23.78,25,
  0,23.78,25,
  0,23.78,25,
  -9.08,14.69,25,
  0,14.69,25,
  -14.69,0,25,
  0,-14.6946,25,
  0,-14.6946,25,
  0,-14.6946,25,
  -9.08,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  0,-23.78,25,
  9.08,-14.69,25,
  0,-14.69,25,
  14.69,0,25,
  0,0,25,
  14.69,14.69,25,
  0,14.69,25,
  9.08,23.78,25,
  0,23.78,25,
  0,23.78,25,
  0,23.78,25,
  -9.08,14.69,25,
  0,14.69,25,
  -14.69,0,25,
  0,-14.6946,25,

  ]);

  var normalGnd2 = new Float32Array([
    0, 14.69,25,
    0, 14.69,25,
    0, 14.69,25,
    -9.08,23.77,25,
    0, 23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    9.08,14.69,25,
    0, 14.69,25,
    14.69,0,25,
    0,0,25,
    14.69,-14.69,25,
    0,-14.69,25,
    9.08,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    -9.08,-14.69,25,
    0,-14.69,25,
    -14.69,0,25,
    0, 14.6946,25,
    0, 14.6946,25,
    0, 14.6946,25,
    -9.08,23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    9.08,14.69,25,
    0,14.69,25,
    14.69,0,25,
    0,0,25,
    14.69,-14.69,25,
    0,-14.69,25,
    9.08,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    -9.08,-14.69,25,
    0,-14.69,25,
    -14.69,0,25,
    0,14.6946,25,

    0, 14.69,25,
    0, 14.69,25,
    -9.08,23.77,25,
    0, 23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    9.08,14.69,25,
    0, 14.69,25,
    14.69,0,25,
    0,0,25,
    14.69,-14.69,25,
    0,-14.69,25,
    9.08,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    -9.08,-14.69,25,
    0,-14.69,25,
    -14.69,0,25,
    0, 14.6946,25,
    0, 14.6946,25,
    0, 14.6946,25,
    -9.08,23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    0, 23.78,25,
    9.08,14.69,25,
    0,14.69,25,
    14.69,0,25,
    0,0,25,
    14.69,-14.69,25,
    0,-14.69,25,
    9.08,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    0,-23.78,25,
    -9.08,-14.69,25,
    0,-14.69,25,
    -14.69,0,25,
    0,14.6946,25,




    ]);

  var normalStar = new Float32Array([
    0,    0.5400,    0.2700,
0,    0.5400,    0.2700,
0,    0.5400,    0.2700,

-0.5000,   -0.2700,    0.2800,
-0.5000,   -0.2700,    0.2800,
-0.5000,   -0.2700,    0.2800,

-0.5000,    0.2700,    0.2800,
-0.5000,    0.2700,    0.2800,
-0.5000,    0.2700,    0.2800,

0,   -0.5400,   0.2700,
0,   -0.5400,   0.2700,
0,   -0.5400,   0.2700,

-0.5000,   -0.2900,    0.2900,
-0.5000,   -0.2900,    0.2900,
-0.5000,   -0.2900,    0.2900,

0.5000,   -0.2900,    0.2900,
0.5000,   -0.2900,    0.2900,
0.5000,   -0.2900,    0.2900,




0,   -0.5400,    0.2700,
0,   -0.5400,    0.2700,
0,   -0.5400,    0.2700,

0.5000,    0.2700,    0.2800,
0.5000,    0.2700,    0.2800,
0.5000,    0.2700,    0.2800,

0.5000,   -0.2700,    0.2800,
0.5000,   -0.2700,    0.2800,
0.5000,   -0.2700,    0.2800,

0,   0.5400,   0.2700,
0,   0.5400,   0.2700,
0,   0.5400,   0.2700,

0.5000,   0.2900,    0.2900,
0.5000,   0.2900,    0.2900,
0.5000,   0.2900,    0.2900,

-0.5000,   0.2900,    0.2900,
-0.5000,   0.2900,    0.2900,
-0.5000,   0.2900,    0.2900,



-0.5000,    0.2700,    0.2800,
-0.5000,    0.2700,    0.2800,
-0.5000,    0.2700,    0.2800,

0.5000,    0.2900,   -0.2900,
0.5000,    0.2900,   -0.2900,
0.5000,    0.2900,   -0.2900,

 0,    0.5400,   -0.2700,
 0,    0.5400,   -0.2700,
 0,    0.5400,   -0.2700,

 0.5000,   -0.2700,   -0.2800,
 0.5000,   -0.2700,   -0.2800,
 0.5000,   -0.2700,   -0.2800,

 0.5000,    0.2700,   -0.2800,
 0.5000,    0.2700,   -0.2800,
 0.5000,    0.2700,   -0.2800,

 0,   -0.5400,   -0.2700,
 0,   -0.5400,   -0.2700,
 0,   -0.5400,   -0.2700,



 0.5000,   -0.2900,   -0.2900,
 0.5000,   -0.2900,   -0.2900,
 0.5000,   -0.2900,   -0.2900,

 -0.5000,   -0.2900,  -0.2900,
 -0.5000,   -0.2900,  -0.2900,
 -0.5000,   -0.2900,  -0.2900,

 0,   -0.5400,   -0.2700,
 0,   -0.5400,   -0.2700,
 0,   -0.5400,   -0.2700,

 -0.5000,    0.2700,   -0.2800,
 -0.5000,    0.2700,   -0.2800,
 -0.5000,    0.2700,   -0.2800,

 -0.5000,    -0.2700,   -0.2800,
 -0.5000,    -0.2700,   -0.2800,
 -0.5000,    -0.2700,   -0.2800,

 0,    0.5400,   -0.2700,
 0,    0.5400,   -0.2700,
 0,    0.5400,   -0.2700,

    ]);



  var normals = new Float32Array(ballspositions.length + gndVerts1.length + gndVerts2.length + triVerts.length+
                    cylVerts.length + starVerts.length);
  for(i=0,j=0; j< ballspositions.length; i++,j++) {
    normals[i] = ballspositions[j];
  }
  for(j=0; j< gndVerts1.length; i++, j++) {
    normals[i] = normalGnd1[j];

  }
  for(j=0; j< gndVerts2.length; i++, j++) {
    normals[i] = normalGnd2[j];

  }
  for(j=0; j< triVerts.length; i++, j++) {
    normals[i] = normalTri[j];
  }
  for(j=0; j< cylVerts.length; i++, j++) {
    normals[i] = normalCyl[j];
  }
  for(j=0; j< starVerts.length; i++, j++) {
    normals[i] = normalStar[j];
  }

  if (!initArrayBuffer(gl, 'a_Position', positions, gl.FLOAT, 3)) return -1;
  if (!initArrayBuffer(gl, 'a_Normal', normals, gl.FLOAT, 3))  return -1;
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  var indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  return indices.length;
}

function initArrayBuffer(gl, attribute, data, type, num) {
 var buffer = gl.createBuffer();
 if (!buffer) {
  console.log('Failed to create the buffer object');
  return false;
}
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
var a_attribute = gl.getAttribLocation(gl.program, attribute);
if (a_attribute < 0) {
  console.log('Failed to get the storage location of ' + attribute);
  return false;
}
gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
gl.enableVertexAttribArray(a_attribute);
return true;
}


  function draw(gl, canvas){

    gl.uniform4f(u_eyePosWorld, g_EyeX, g_EyeY,g_EyeZ, 1);

    Lamp1.lampPos.set([g_EyeX, g_EyeY, g_EyeZ]);
    setLamp(Lamp1);
    Lamp2.lampPos.set([Head_x, Head_y, Head_z]);
    setLamp(Lamp2);

    gl.viewport(0 , 0, innerWidth, innerHeight);

    modelMatrix.setScale(0.5,0.5,0.5);
    pushMatrix(modelMatrix);

    drawMyscene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, currentAngle, canvas);

  }



  function prepareMatrix(){
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  mvpMatrix.setPerspective(40,innerWidth / innerHeight, 1, 100);
  mvpMatrix.lookAt(g_EyeX,  g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ, 0,  0, 1);
  mvpMatrix.multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  }

  function drawMyscene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, currentAngle, canvas){
  // Draw ball and star 1
  myMaterial =  Material(1);
  setMaterial(myMaterial);
  modelMatrix.translate( -15, 5, 0);
  modelMatrix.scale(0.5, 0.5, 0.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  myMaterial =  Material(6);
  setMaterial(myMaterial);
  modelMatrix.scale(2.5, 2.5, 2.5);
  modelMatrix.translate( 0, 0, 1.0);
  modelMatrix.rotate(90, 1, 0, 0);
  modelMatrix.rotate(currentAngle, 0, 0, 1);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP,starstart/floatsPerVertex, starVerts.length/floatsPerVertex);
  


  // Draw ball and star 2
  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  myMaterial = new Material(18);
  setMaterial(myMaterial);
  modelMatrix.translate( -12, 10, 0);
  modelMatrix.scale(0.5, 0.5, 0.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  myMaterial =  Material(6);
  setMaterial(myMaterial);
  modelMatrix.scale(2.5, 2.5, 2.5);
  modelMatrix.translate( 0, 0, 1.0);
  modelMatrix.rotate(90, 1, 0, 0);
  modelMatrix.rotate(currentAngle, 0, 0, 1);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP,starstart/floatsPerVertex, starVerts.length/floatsPerVertex);



  // Draw ball and star 3
  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  myMaterial = new Material(12);
  setMaterial(myMaterial);
  modelMatrix.translate( -9, 15, 0);
  modelMatrix.scale(0.5, 0.5, 0.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  modelMatrix.translate( 0, 0, 1.5);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

  myMaterial =  Material(6);
  setMaterial(myMaterial);
  modelMatrix.scale(2.5, 2.5, 2.5);
  modelMatrix.translate( 0, 0, 1.0);
  modelMatrix.rotate(90, 1, 0, 0);
  modelMatrix.rotate(currentAngle, 0, 0, 1);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP,starstart/floatsPerVertex, starVerts.length/floatsPerVertex);



// Draw Tree 1
modelMatrix = popMatrix();
pushMatrix(modelMatrix);
myMaterial = new Material(7);
setMaterial(myMaterial);
modelMatrix.translate(-22.0, -5.0, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.rotate(Math.abs(currentAngle * 0.2), 0, 1, 0);
modelMatrix.scale(1.5,1.5,1.5);
prepareMatrix();
gl.drawArrays(gl.TRIANGLE_STRIP, cylstart/floatsPerVertex, cylVerts.length/floatsPerVertex);

myMaterial = new Material(17);
setMaterial(myMaterial);
modelMatrix.rotate(-80, 1, 0, 0);
modelMatrix.translate(0.0, -2, 0.0);
modelMatrix.scale(1.4,1.4,1.4);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);




// Draw Tree 2
modelMatrix = popMatrix();
pushMatrix(modelMatrix);
myMaterial = new Material(7);
setMaterial(myMaterial);
modelMatrix.translate(-21.0, 0.0, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.rotate(Math.abs(currentAngle * 0.2), 0, 1, 0);
modelMatrix.scale(1.4,1.4,1.4);
prepareMatrix();
gl.drawArrays(gl.TRIANGLE_STRIP, cylstart/floatsPerVertex, cylVerts.length/floatsPerVertex);

myMaterial = new Material(17);
setMaterial(myMaterial);
modelMatrix.rotate(-80, 1, 0, 0);
modelMatrix.translate(0.0, -2, 0.0);
modelMatrix.scale(1.4,1.4,1.4);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);


// Draw Tree 3
modelMatrix = popMatrix();
pushMatrix(modelMatrix);
myMaterial = new Material(7);
setMaterial(myMaterial);
modelMatrix.translate(-20.0, 5.0, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.rotate(Math.abs(currentAngle * 0.2), 0, 1, 0);
modelMatrix.scale(1.3,1.3,1.3);
prepareMatrix();
gl.drawArrays(gl.TRIANGLE_STRIP, cylstart/floatsPerVertex, cylVerts.length/floatsPerVertex);

myMaterial = new Material(17);
setMaterial(myMaterial);
modelMatrix.rotate(-80, 1, 0, 0);
modelMatrix.translate(0.0, -2, 0.0);
modelMatrix.scale(1.4,1.4,1.4);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);


// Draw Tree 4
modelMatrix = popMatrix();
pushMatrix(modelMatrix);
myMaterial = new Material(7);
setMaterial(myMaterial);
modelMatrix.translate(-19.0, 10.0, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.rotate(Math.abs(currentAngle * 0.2), 0, 1, 0);
modelMatrix.scale(1.2,1.2,1.2);
prepareMatrix();
gl.drawArrays(gl.TRIANGLE_STRIP, cylstart/floatsPerVertex, cylVerts.length/floatsPerVertex);

myMaterial = new Material(17);
setMaterial(myMaterial);
modelMatrix.rotate(-80, 1, 0, 0);
modelMatrix.translate(0.0, -2, 0.0);
modelMatrix.scale(1.4,1.4,1.4);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);
modelMatrix.translate(0.0, 0.5, 0.0);
modelMatrix.translate(0.0, 0.0, 1.0);
modelMatrix.scale(0.9,0.9,0.9);
prepareMatrix();
gl.drawArrays(gl.TRIANGLES, tristart/floatsPerVertex, triVerts.length/floatsPerVertex);



// Draw ground
  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  myMaterial = new Material(3);
  setMaterial(myMaterial);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);
 
  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);  





  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);

  myMaterial = new Material(3);
  setMaterial(myMaterial);
  modelMatrix.translate(0.0,-10.0,0.0);
  prepareMatrix();
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart1/floatsPerVertex, gndVerts1.length/floatsPerVertex);
  gl.drawArrays(gl.TRIANGLE_STRIP, gndVertsstart2/floatsPerVertex, gndVerts2.length/floatsPerVertex);  


  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  myMaterial = new Material(20);
  setMaterial(myMaterial);
  modelMatrix.translate( -10, 10, 12);
  modelMatrix.scale(2, 2, 2);
  prepareMatrix();
  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0);

}


function keydown(ev) {
 switch(ev.keyCode) {
       case 37:
       g_EyeX -= 0.1;    //left arrow step left
       g_LookAtX -= 0.1;
       break;
       case 39:       //right arrow step right
       g_EyeX += 0.1;
       g_LookAtX += 0.1;
       break
       case 38:      // up arrow step forward
       g_EyeY += 0.1;
       g_LookAtY += 0.1;
       break
       case 40:     // down arrow step backward
       g_EyeY -= 0.1;
       g_LookAtY -= 0.1;
       break
       case 81:    // q step up
       g_EyeZ += 0.1;
       g_LookAtZ += 0.1;
       break
       case 69:    // e step down
       g_EyeZ -= 0.1;
       g_LookAtZ -= 0.1;
       break; 
       case 65:    //a look left
       theta1 -= 0.05;
       g_LookAtX =  g_EyeX + Math.sin(theta1);
       g_LookAtY =  g_EyeY +  Math.cos(theta1);
       break
       case 68:    //d look down
       theta1 += 0.05;
       g_LookAtX = g_EyeX + Math.sin(theta1);
       g_LookAtY = g_EyeY +  Math.cos(theta1);
       break
       case 87:    //w look up
       theta2 += 0.05;
       g_LookAtZ = g_EyeZ + Math.sin(theta2);
       break
       case 83:    //s look down 
       theta2 -= 0.05;
       g_LookAtZ = g_EyeZ + Math.sin(theta2);
       break

       case 72:   //h headlight step left
       Head_x -= 0.2;
       break
       case 75:    //k headlight step right
       Head_x += 0.2;
       break
       case 73:    //i headlight step backward
       Head_y -= 0.2;
       break
       case 89:    //y headlight step forward
       Head_y += 0.2;
       break
       case 85:   //u headlight step upward
       Head_z += 0.2;
       break
       case 74:   //j headlight step downward
       Head_z -= 0.2;
       break

       case 79:   // o worldlight on/off
      worldlightSign += 1;
      if (worldlightSign%2) {
        document.getElementById('world').innerHTML = 'Off';
      }
      else{
        document.getElementById('world').innerHTML = 'On'; 
      };
       break

       case 80:   // p headlight on/off
      headlightSign += 1;
      if (headlightSign%2) {
        document.getElementById('head').innerHTML = 'Off';
      }
      else{
        document.getElementById('head').innerHTML = 'On'; 
      };
       break

       case 78:   // n change lighting mode
      lightingSign += 1;
      gl.uniform1i(u_LightMod, lightingSign%2);
      if (lightingSign%2) {
        document.getElementById('lighting').innerHTML = 'Blinn-Phong';
      }
      else{
        document.getElementById('lighting').innerHTML = 'Phong'; 
      };
       break

       case 77:   // m change shading mode
      shadingSign += 1;
      gl.uniform1i(u_ShadeMod, shadingSign%2);
      if (shadingSign%2) {
        document.getElementById('shadering').innerHTML = 'Gauraud';
      }
      else{
        document.getElementById('shadering').innerHTML = 'Phong'; 
      };
       break

       case 66:   // b change ATT
      adist += 1;
      gl.uniform1i(ATT, adist%3);
       break
     }
   }


 function setMaterial(material){
      gl.uniform3f(u_Ke, material.emissive[0], material.emissive[1], material.emissive[2]);
      gl.uniform3f(u_Ka, material.ambient[0], material.ambient[1], material.ambient[2]);
      gl.uniform3f(u_Kd, material.diffuse[0], material.diffuse[1], material.diffuse[2]);
      gl.uniform3f(u_Ks, material.specular[0], material.specular[1], material.specular[2]);
      gl.uniform1i(u_Kshiny, material.shiny);
    }
    
 function setLamp(Lamp){
      gl.uniform3fv(Lamp.u_LampPos,  Lamp.lampPos); 
      gl.uniform3fv(Lamp.u_LampAmbi, Lamp.lampAmbi);
      gl.uniform3fv(Lamp.u_LampDiff, Lamp.lampDiff);
      gl.uniform3fv(Lamp.u_LampSpec, Lamp.lampSpec);
    }



  function resize() {
  var canvas = document.getElementById('webgl');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  }

  function Material(materialType)
  {
    K_emit = [];
    K_ambi = [];
    K_spec = [];
    K_diff = [];
    K_shiny = 0.0;
    switch(materialType){
        case MATL_RED_PLASTIC: // 1
        K_emit.push(0.0,     0.0,    0.0,    1.0);
        K_ambi.push(0.1,     0.1,    0.1,    1.0);
        K_diff.push(0.6,     0.0,    0.0,    1.0);
        K_spec.push(0.6,     0.6,    0.6,    1.0);   
        K_shiny = 100.0;
        break;
        case MATL_GRN_PLASTIC: // 2
        K_emit.push(0.0,     0.0,    0.0,    1.0);
        K_ambi.push(0.05,    0.05,   0.05,   1.0);
        K_diff.push(0.0,     0.6,    0.0,    1.0);
        K_spec.push(0.2,     0.2,    0.2,    1.0);   
        K_shiny = 60.0;
        break;
        case MATL_BLU_PLASTIC: // 3
        K_emit.push(0.0,     0.0,    0.0,    1.0);
        K_ambi.push(0.05,    0.05,   0.05,   1.0);
        K_diff.push(0.0,     0.0,    0.6,    1.0);
        K_spec.push(0.1,     0.2,    0.3,    1.0);   
        K_shiny = 5.0;
        break;
        case MATL_BLACK_PLASTIC:
        K_emit.push(0.0,     0.0,    0.0,    1.0);
        K_ambi.push(0.0,     0.0,    0.0,    1.0);
        K_diff.push(0.01,    0.01,   0.01,   1.0);
        K_spec.push(0.5,     0.5,    0.5,    1.0);   
        K_shiny = 32.0;
        break;
        case MATL_BLACK_RUBBER:
        K_emit.push(0.0,     0.0,    0.0,    1.0);
        K_ambi.push(0.02,    0.02,   0.02,   1.0);
        K_diff.push(0.01,    0.01,   0.01,   1.0);
        K_spec.push(0.4,     0.4,    0.4,    1.0);   
        K_shiny = 10.0;
        break;
        case MATL_BRASS:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.329412, 0.223529, 0.027451, 1.0);
        K_diff.push(0.780392, 0.568627, 0.113725, 1.0);
        K_spec.push(0.992157, 0.941176, 0.807843, 1.0);   
        K_shiny = 27.8974;
        break;
        case MATL_BRONZE_DULL:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.2125,   0.1275,   0.054,    1.0);
        K_diff.push(0.714,    0.4284,   0.18144,  1.0);
        K_spec.push(0.393548, 0.271906, 0.166721, 1.0);  
        K_shiny = 25.6;
        break;
        case MATL_BRONZE_SHINY:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.25,     0.148,    0.06475,  1.0);
        K_diff.push(0.4,      0.2368,   0.1036,   1.0);
        K_spec.push(0.774597, 0.458561, 0.200621, 1.0);  
        K_shiny = 76.8;
        break;
        case MATL_CHROME:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.25,     0.25,     0.25,     1.0);
        K_diff.push(0.4,      0.4,      0.4,      1.0);
        K_spec.push(0.774597, 0.774597, 0.774597, 1.0);  
        K_shiny = 76.8;
        break;
        case MATL_COPPER_DULL:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.19125,  0.0735,   0.0225,   1.0);
        K_diff.push(0.7038,   0.27048,  0.0828,   1.0);
        K_spec.push(0.256777, 0.137622, 0.086014, 1.0);  
        K_shiny = 12.8;
        break;
        case MATL_COPPER_SHINY:
        K_emit.push(0.0,      0.0,      0.0,       1.0);
        K_ambi.push(0.2295,   0.08825,  0.0275,    1.0);
        K_diff.push(0.5508,   0.2118,   0.066,     1.0);
        K_spec.push(0.580594, 0.223257, 0.0695701, 1.0);  
        K_shiny = 51.2;
        break;
        case MATL_GOLD_DULL:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.24725,  0.1995,   0.0745,   1.0);
        K_diff.push(0.75164,  0.60648,  0.22648,  1.0);
        K_spec.push(0.628281, 0.555802, 0.366065, 1.0);  
        K_shiny = 51.2;
        break;
        case MATL_GOLD_SHINY:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.24725,  0.2245,   0.0645,   1.0);
        K_diff.push(0.34615,  0.3143,   0.0903,   1.0);
        K_spec.push(0.797357, 0.723991, 0.208006, 1.0);  
        K_shiny = 83.2;
        break;
        case MATL_PEWTER:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.105882, 0.058824, 0.113725, 1.0);
        K_diff.push(0.427451, 0.470588, 0.541176, 1.0);
        K_spec.push(0.333333, 0.333333, 0.521569, 1.0);  
        K_shiny = 9.84615;
        break;
        case MATL_SILVER_DULL:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.19225,  0.19225,  0.19225,  1.0);
        K_diff.push(0.50754,  0.50754,  0.50754,  1.0);
        K_spec.push(0.508273, 0.508273, 0.508273, 1.0);  
        K_shiny = 51.2;
        break;
        case MATL_SILVER_SHINY:
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.23125,  0.23125,  0.23125,  1.0);
        K_diff.push(0.2775,   0.2775,   0.2775,   1.0);
        K_spec.push(0.773911, 0.773911, 0.773911, 1.0);  
        K_shiny = 89.6;
        break;
        case MATL_EMERALD:  //17
        K_emit.push(0.0,     0.0,      0.0,     1.0);
        K_ambi.push(0.0215,  0.1745,   0.0215,  0.55);
        K_diff.push(0.07568, 0.61424,  0.07568, 0.55);
        K_spec.push(0.633,   0.727811, 0.633,   0.55);   
        K_shiny = 76.8;
        break;
        case MATL_JADE: //18
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.135,    0.2225,   0.1575,   0.95);
        K_diff.push(0.54,     0.89,     0.63,     0.95);
        K_spec.push(0.316228, 0.316228, 0.316228, 0.95);   
        K_shiny = 12.8;
        break;
        case MATL_OBSIDIAN: //19
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.05375,  0.05,     0.06625,  0.82);
        K_diff.push(0.18275,  0.17,     0.22525,  0.82);
        K_spec.push(0.332741, 0.328634, 0.346435, 0.82);   
        K_shiny = 38.4;
        break;
        case MATL_PEARL: //20
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.25,     0.20725,  0.20725,  0.922);
        K_diff.push(1.0,      0.829,    0.829,    0.922);
        K_spec.push(0.296648, 0.296648, 0.296648, 0.922);   
        K_shiny = 11.264;
        break;
        case MATL_RUBY: //21
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.1745,   0.01175,  0.01175,  0.55);
        K_diff.push(0.61424,  0.04136,  0.04136,  0.55);
        K_spec.push(0.727811, 0.626959, 0.626959, 0.55);   
        K_shiny = 76.8;
        break;
        case MATL_TURQUOISE: // 22
        K_emit.push(0.0,      0.0,      0.0,      1.0);
        K_ambi.push(0.1,      0.18725,  0.1745,   0.8);
        K_diff.push(0.396,    0.74151,  0.69102,  0.8);
        K_spec.push(0.297254, 0.30829,  0.306678, 0.8);   
        K_shiny = 12.8;
        break;
        default:
        K_emit.push(0.5, 0.0, 0.0, 1.0);
        K_ambi.push(0.0, 0.0, 0.0, 1.0);
        K_diff.push(0.0, 0.0, 0.0, 1.0);
        K_spec.push(0.0, 0.0, 0.0, 1.0);
        K_shiny = 1.0;
        break;
      }
      return {emissive: K_emit, ambient: K_ambi, diffuse: K_diff, specular: K_spec, shiny: K_shiny};
    }





    var g_last = Date.now();

    function animate(angle) {
      var now = Date.now();
      var elapsed = now - g_last;
      g_last = now;
      var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
      if(newAngle > 180.0) newAngle = newAngle - 360.0;
      if(newAngle <-180.0) newAngle = newAngle + 360.0;
      return newAngle;
    }


 function changeAR() {
  var currentAR=document.getElementById('AR').value; 
  Head_AR=currentAR;
  document.getElementById('AR_value').innerHTML ='R:'+ currentAR;
}

 function changeAG() {
  var currentAG=document.getElementById('AG').value; 
  Head_AG=currentAG;
  document.getElementById('AG_value').innerHTML ='G:'+ currentAG;
}

 function changeAB() {
  var currentAB=document.getElementById('AB').value; 
  Head_AB=currentAB;
  document.getElementById('AB_value').innerHTML ='B:'+ currentAB;
}


 function changeDR() {
  var currentDR=document.getElementById('DR').value; 
  Head_DR=currentDR;
  document.getElementById('DR_value').innerHTML ='R:'+ currentDR;
}

 function changeDG() {
  var currentDG=document.getElementById('DG').value; 
  Head_DG=currentDG;
  document.getElementById('DG_value').innerHTML ='G:'+ currentDG;
}

 function changeDB() {
  var currentDB=document.getElementById('DB').value; 
  Head_DB=currentDB;
  document.getElementById('DB_value').innerHTML ='B:'+ currentDB;
}


 function changeSR() {
  var currentSR=document.getElementById('SR').value; 
  Head_SR=currentSR;
  document.getElementById('SR_value').innerHTML ='R:'+ currentSR;
}

 function changeSG() {
  var currentSG=document.getElementById('SG').value; 
  Head_SG=currentSG;
  document.getElementById('SG_value').innerHTML ='G:'+ currentSG;
}

 function changeSB() {
  var currentSB=document.getElementById('SB').value; 
  Head_SB=currentSB;
  document.getElementById('SB_value').innerHTML ='B:'+ currentSB;
}