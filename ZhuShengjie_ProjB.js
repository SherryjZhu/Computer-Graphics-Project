
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'attribute vec4 a_Normal;\n' +  //surface normal vector
  
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_NormalMatrix;\n' +  //transformation matrix of the normal vector

  'varying vec3 v_Position;\n' +
  'varying vec4 v_Color;\n' +
  'varying vec3 v_Normal;\n' +

  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  '  v_Position = vec3(u_ModelMatrix * a_Position);\n' +
  '  v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
  '  v_Color = a_Color;\n' +
  '  gl_PointSize = 1.0;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +

  'uniform vec3 u_LightColor;\n' +          //light color
  'uniform vec3 u_LightPosition;\n' +       //position of the light source
  'uniform vec3 u_AmbientLightColor;\n' +   //ambient light color
  'uniform vec4 u_ColorMod;\n' +            //color modifier

  'varying vec4 v_Color;\n' +
  'varying vec3 v_Normal;\n' +
  'varying vec3 v_Position;\n' + 

  'void main() {\n' +
  //normalize the normal because it is interpolated and is not 1.0 in length anymore
  '  vec3 normal = normalize(v_Normal);\n' +
  //calculate the light direction and make it 1.0 in length
  '  vec3 lightDirection = normalize(u_LightPosition-v_Position);\n' +
  //the dot product of the light direction and the normal
  '  float nDotL = max(dot(lightDirection, normal), 0.0);\n' +  //clamped value
  //calculate the final color from diffuse reflection and ambient reflection
  '  vec4 modColor = v_Color + u_ColorMod;\n' +
  '  vec3 diffuse = u_LightColor * modColor.rgb * nDotL;\n' +
  '  vec3 ambient = u_AmbientLightColor * modColor.rgb;\n' + 
  '  gl_FragColor = vec4(diffuse+ambient, modColor.a);\n' +
  '}\n';
var currentAngle = 0.0;
var ANGLE_STEP = 45.0;  
var floatsPerVertex = 10; // # of Float32Array elements used for each vertex
                          // (x,y,z)position + (r,g,b)color
var moveStep = 0.15;
var lookStep = 0.02;
var PHI_NOW = 0;
var THETA_NOW = 0;
var update = -1;

var modelMatrix = new Matrix4();
var viewMatrix = new Matrix4();
var projMatrix = new Matrix4();
var mvpMatrix = new Matrix4();
var normalMatrix = new Matrix4();
var colorMod = new Vector4();

var c30 = Math.sqrt(0.75);
var sq2 = Math.sqrt(2.0);

var isDrag=false;   // mouse-drag: true when user holds down mouse button
var xMclik=0.0;     // last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;  // total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;  

var qNew = new Quaternion(0,0,0,1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1); // 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();       // rotation matrix, made from latest qTot
var ll = 1;
var rr = 1;
var bb = 1;
var tt = 1;
var nn = 1;
var ff = 1;
var xx = 0;
var zz = 0;
var yy = 1;
var change = 0;
var go = 0;
var leftsigh=0;
var rightsigh=0;
var aright = 0;
var aleft = 0;
var angleX = 0;
var angleY = 0;
var g_EyeX = 0.20, g_EyeY = 0.25, g_EyeZ = 4.25; 
var g_LookAtX = 0.0, g_LookAtY = 0.0, g_LookAtZ = 0.0;



//var canvas;
function main() {
//==============================================================================
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;

  console.log('User Guide: Press Up/Down/Left/Right keys to change the eye position.')
  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
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
  var n = initVertexBuffers(gl);

  if (n < 0) {
    console.log('Failed to specify the vertex infromation');
    return;
  }

  canvas.onmousedown  = function(ev){myMouseDown( ev, gl, canvas) }; 
            // when user's mouse button goes down, call mouseDown() function
  canvas.onmousemove =  function(ev){myMouseMove( ev, gl, canvas) };
                      // when the mouse moves, call mouseMove() function          
  canvas.onmouseup =    function(ev){myMouseUp(   ev, gl, canvas)};

  // Specify the color for clearing <canvas>
  gl.clearColor(0.13, 0.67, 0.8, 1);

  // Get the storage locations of u_ViewMatrix and u_ProjMatrix variables
  var u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  var u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
  var u_AmbientLightColor = gl.getUniformLocation(gl.program, 'u_AmbientLightColor');
  var u_ColorMod = gl.getUniformLocation(gl.program, 'u_ColorMod');
  
  if (!u_MvpMatrix || !u_ModelMatrix || !u_NormalMatrix || !u_LightColor || !u_LightPosition || !u_AmbientLightColor || !u_ColorMod) { 
    console.log('Failed to get the location of uniform variables');
    return;
  }
 
 //world coordinate system
  //set the light color --> (1.0, 1.0, 1.0)
  gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);    //modified for better visual effect
  //set the light position --> "overhead" --> y=10.0
  gl.uniform3f(u_LightPosition, 10.0, 10.0, 10.0); //modified for better visual effect
  //set the ambient light color --> (0.3, 0.3, 0.3)
  gl.uniform3f(u_AmbientLightColor, 0.3, 0.3, 0.3);

 document.onkeydown = function(ev){ keydown(ev, gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix,
                                            u_ColorMod, currentAngle, canvas);};

  testQuaternions();
   var tick = function() {
   if (go%2) {
    if (leftsigh) {
      aleft += 1;
      angleX = -Math.cos((aleft-aright)*0.02)*0.2;
      angleY = Math.sin((aright-aleft)*0.02)*0.2;
      };
      if (rightsigh) {
        aright += 1;
        angleX = Math.cos((aleft-aright)*0.02)*0.2;
        angleY = -Math.sin((aright-aleft)*0.02)*0.2;  
      };
      
      g_EyeX = g_EyeX + Math.sin((aright-aleft)*0.02)*0.2;
      g_EyeZ = g_EyeZ - Math.cos((aleft-aright)*0.02)*0.2;

      g_LookAtX = g_EyeX + Math.sin((aright-aleft)*0.01);
      g_LookAtZ = g_EyeZ - Math.cos((aleft-aright)*0.01);
    };
    currentAngle = animate(currentAngle);  // Update the rotation angle
    var n = initVertexBuffers(gl);
    draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas);   // Draw the triangles
    requestAnimationFrame(tick, canvas);   
                      // Request that the browser re-draw the webpage
 };
 tick(); 

}


function initVertexBuffers(gl) {
//==============================================================================
  
  makeHead();
  makeGroundGrid();
  makeTetrahedron();
  makeBody();
  makeCylinder();
  makeTorus();
  makeAxes();
  makeStar();



  var mySiz = ( ttrVerts.length + bdyVerts.length + hdVerts.length + gndVerts.length +
               cylVerts.length + torVerts.length + axVerts.length + starVerts.length);

  // How many vertices total?
  var nn = mySiz / floatsPerVertex;
  //console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
  // Copy all shapes into one big Float32 array:
  var colorShapes = new Float32Array(mySiz);


   
  ttrStart = 0;           // next, we'll store the sphere;
  for(i=0,j=0; j< ttrVerts.length; i++, j++) {// don't initialize i -- reuse it!
    colorShapes[i] = ttrVerts[j];
    }
/*
  sphStart = i;           // next we'll store the ground-plane;
  for(j=0; j< sphVerts.length; i++, j++) {
    colorShapes[i] = sphVerts[j];
    }
*/    
    bdyStart = i;           // next, we'll store the torus;
  for(j=0; j< bdyVerts.length; i++, j++) {
    colorShapes[i] = bdyVerts[j];
    }
    
    hdStart = i;           // next we'll store the ground-plane;
  for(j=0; j< hdVerts.length; i++, j++) {
    colorShapes[i] = hdVerts[j];
  }

    gndStart=i;
  for(j=0;j<gndVerts.length; i++, j++){
    colorShapes[i]=gndVerts[j];
  }
    cylStart=i;
  for(j=0;j<cylVerts.length;i++,j++){
    colorShapes[i]=cylVerts[j];
  }
    torStart=i;
  for(j=0;j<torVerts.length;i++,j++){
    colorShapes[i]=torVerts[j];
  }
    axStart=i;
  for(j=0;j<axVerts.length;i++,j++){
    colorShapes[i]=axVerts[j];
  }
  starStart=i;
  for(j=0;j<starVerts.length;i++,j++){
    colorShapes[i]=starVerts[j];
  }


  
  // Create a buffer object
  var vertexColorbuffer = gl.createBuffer();  
  if (!vertexColorbuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  var shapeBufferHandle = gl.createBuffer();  
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);

  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?
    
  //Get graphics system's handle for our Vertex Shader's position-input variable: 
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -1;
  }
  // Use handle to specify how to retrieve position data from our VBO:
  gl.vertexAttribPointer(
      a_Position,   // choose Vertex Shader attribute to fill with data
      4,            // how many values? 1,2,3 or 4.  (we're using x,y,z,w)
      gl.FLOAT,     // data type for each value: usually gl.FLOAT
      false,        // did we supply fixed-point data AND it needs normalizing?
      FSIZE * floatsPerVertex,    // Stride -- how many bytes used to store each vertex?
                    // (x,y,z,w, r,g,b) * bytes/value
      0);           // Offset -- now many bytes from START of buffer to the
                    // value we will actually use?
  gl.enableVertexAttribArray(a_Position);  
                    // Enable assignment of vertex buffer object's position data

  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return -1;
  }
  // Use handle to specify how to retrieve color data from our VBO:
  gl.vertexAttribPointer(
    a_Color,        // choose Vertex Shader attribute to fill with data
    3,              // how many values? 1,2,3 or 4. (we're using R,G,B)
    gl.FLOAT,       // data type for each value: usually gl.FLOAT
    false,          // did we supply fixed-point data AND it needs normalizing?
    FSIZE * floatsPerVertex,      // Stride -- how many bytes used to store each vertex?
                    // (x,y,z,w, r,g,b) * bytes/value
    FSIZE * 4);     // Offset -- how many bytes from START of buffer to the
                    // value we will actually use?  Need to skip over x,y,z,w
                    
  gl.enableVertexAttribArray(a_Color);  
                    // Enable assignment of vertex buffer object's position data
 var a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if(a_Normal < 0)
  {
    console.log('Failed to get the storage location of a_Normal');
    return -1;
  }
  gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, FSIZE * floatsPerVertex, FSIZE * 7);
  gl.enableVertexAttribArray(a_Normal);
  //--------------------------------DONE!
  // Unbind the buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
}

function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

  var xcount = 100;     // # of lines to draw in x,y to make the grid.
  var ycount = 100;   
  var xymax = 50.0;     // grid size; extends to cover +/-xymax in x and y.
  var xColr = new Float32Array([1.0, 1.0, 0.19]);  
  var yColr = new Float32Array([1.0, 1.0, 0.19]);  
  
  // Create an (global) array to hold this ground-plane's vertices:
  gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
            // draw a grid made of xcount+ycount lines; 2 vertices per line.
            
  var xgap = xymax/(xcount-1);    // HALF-spacing between lines in x,y;
  var ygap = xymax/(ycount-1);    // (why half? because v==(0line number/2))
  
  // First, step thru x values as we make vertical lines of constant-x:
  for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
    if(v%2==0) {  // put even-numbered vertices at (xnow, -xymax, 0)
      gndVerts[j  ] = -xymax + (v  )*xgap;  // x
      gndVerts[j+1] = -xymax;               // y
      gndVerts[j+2] = 0.0;                  // z
      gndVerts[j+3] = 1.0;
    }
    else {        // put odd-numbered vertices at (xnow, +xymax, 0).
      gndVerts[j  ] = -xymax + (v-1)*xgap;  // x
      gndVerts[j+1] = xymax;                // y
      gndVerts[j+2] = 0.0;                  // z
      gndVerts[j+3] = 1.0;
    }
    gndVerts[j+4] = xColr[0];     // red
    gndVerts[j+5] = xColr[1];     // grn
    gndVerts[j+6] = xColr[2];     // blu
    gndVerts[j+7] = 0;  //dx
    gndVerts[j+8] = 0;  //dy
    gndVerts[j+9] = 1;  //dz
  }
  // Second, step thru y values as wqe make horizontal lines of constant-y:
  // (don't re-initialize j--we're adding more vertices to the array)
  for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
    if(v%2==0) {    // put even-numbered vertices at (-xymax, ynow, 0)
      gndVerts[j  ] = -xymax;               // x
      gndVerts[j+1] = -xymax + (v  )*ygap;  // y
      gndVerts[j+2] = 0.0;                  // z
      gndVerts[j+3] = 1.0;
    }
    else {          // put odd-numbered vertices at (+xymax, ynow, 0).
      gndVerts[j  ] = xymax;                // x
      gndVerts[j+1] = -xymax + (v-1)*ygap;  // y
      gndVerts[j+2] = 0.0;                  // z
      gndVerts[j+3] = 1.0;
    }
    gndVerts[j+4] = yColr[0];     // red
    gndVerts[j+5] = yColr[1];     // grn
    gndVerts[j+6] = yColr[2];     // blu
    gndVerts[j+7] = 0;  //dx
    gndVerts[j+8] = 0;  //dy
    gndVerts[j+9] = 1;  //dz
  }
}

function makeStar() {
 starVerts = new Float32Array([
    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1,// v0 
   -0.29,  0.5,  0.0, 1.0,    1.0,  0.49,  0.0, 0,0,1, // v2 
   -0.83,  0.5,  0.0, 1.0,    1.0,  0.75,  0.0, 0,0,1, // v1

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1,// v0 
   -0.83,  0.5,  0.0, 1.0,   1.0,  0.75,  0.0, 0,0,1,  // v1 
   -0.56,  0.0,  0.0,   1.0,  1.0,  0.49,  0.0, 0,0,1, // v12 

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1, // v0 
   -0.56,  0.0,  0.0,   1.0,  1.0,  0.49,  0.0,  0,0,1,// v12
   -0.83, -0.5,  0.0,   1.0,  1.0,  0.75,  0.0,  0,0,1, // v11

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1, // v0 
   -0.83, -0.5,  0.0,   1.0,  1.0,  0.75,  0.0,  0,0,1, // v11
   -0.29, -0.5,  0.0,   1.0,  1.0,  0.49,  0.0, 0,0,1, // v10

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1,// v0 
   -0.29, -0.5,  0.0,   1.0,  1.0,  0.49,  0.0,  0,0,1,// v10
    0.00, -1.0,  0.0,  1.0,  1.0,  0.75,  0.0, 0,0,1,  // v9

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36,  0,0,1,// v0 
    0.00, -1.0,  0.0,  1.0,   1.0,  0.75,  0.0,  0,0,1, // v9
    0.29, -0.5,  0.0,  1.0,   1.0,  0.49,  0.0,  0,0,1,// v8

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36,  0,0,1,// v0 
    0.29, -0.5,  0.0,  1.0,  1.0,  0.49,  0.0, 0,0,1, // v8
    0.83, -0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v7

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1, // v0
    0.83, -0.5,  0.0, 1.0,   1.0,  0.75,  0.0,  0,0,1, // v7
    0.56,  0.0,  0.0,  1.0,   1.0,  0.49,  0.0,0,0,1, // v6 

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36,0,0,1, // v0 
    0.56,  0.0,  0.0,  1.0,   1.0,  0.49,  0.0, 0,0,1, // v6
    0.83,  0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v5 

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1, // v0 
    0.83,  0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v5 
    0.29,  0.5,  0.0,  1.0,   1.0,  0.49,  0.0, 0,0,1, // v4 

    0.00,  0.0,  1.0, 1.0,    0.98,  0.93,  0.36, 0,0,1, // v0 
    0.29,  0.5,  0.0,  1.0,   1.0,  0.49,  0.0,  0,0,1,// v4 
    0.00,  1.0,  0.0,  1.0,   1.0,  0.75,  0.0,   0,0,1,// v3 

    0.00,  0.0,  1.0, 1.0,   0.98,  0.93,  0.36,  0,0,1,// v0 
    0.00,  1.0,  0.0,  1.0,   1.0,  0.75,  0.0,  0,0,1, // v3 
   -0.29,  0.5,  0.0, 1.0,    1.0,  0.49,  0.0, 0,0,1,// v2

   -0.29,  0.5,  0.0, 1.0,    1.0,  1.0,  0.0,  0,0,1,// v2 
    0.00,  1.0,  0.0,  1.0,   1.0,  0.75,  0.0,  0,0,1, // v3
    0.00,  0.0, -1.0,  1.0,  0.98,0.93,0.36, 0,0,1,// v13

    0.00,  1.0,  0.0,  1.0,   1.0,  0.75,  0.0,  0,0,1, // v3 
    0.29,  0.5,  0.0,  1.0,   1.0,  0.49,  0.0,  0,0,1, // v4
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1, // v13

    0.29,  0.5,  0.0,  1.0,  1.0,  0.49,  0.0,  0,0,1,// v4 
    0.83,  0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v5
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36,0,0,1,// v13

    0.83,  0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v5 
    0.56,  0.0,  0.0,  1.0,   1.0,  0.49,  0.0, 0,0,1, // v6
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36,0,0,1, // v13

    0.56,  0.0,  0.0,  1.0,   1.0,  0.49,  0.0,  0,0,1,// v6 
    0.83, -0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1, // v7
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36,  0,0,1,// v13

    0.83, -0.5,  0.0, 1.0,    1.0,  0.75,  0.0,  0,0,1,  // v7 
     0.29, -0.5,  0.0,  1.0,   1.0,  1.0,  0.0, 0,0,1, // v8 
    0.00,  0.0, -1.0,  1.0,  0.98,0.93,0.36,0,0,1, // v13

    0.29, -0.5,  0.0,  1.0,   1.0,  0.49,  0.0, 0,0,1, // v8 
     0.00, -1.0,  0.0,  1.0,   1.0,  0.75,  0.0, 0,0,1, // v9 
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1, // v13

    0.00, -1.0,  0.0,  1.0,   1.0,  0.75,  0.0, 0,0,1,  // v9 
    -0.29, -0.5,  0.0,   1.0,  1.0,  1.0,  0.0, 0,0,1,  // v10 
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1, // v13

    -0.29, -0.5,  0.0,   1.0,  1.0,  0.49,  0.0,  0,0,1,// v10 
    -0.83, -0.5,  0.0,   1.0,  1.0,  0.75,  0.0, 0,0,1,// v11 
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1,// v13

    -0.83, -0.5,  0.0,   1.0, 1.0,  0.75,  0.0, 0,0,1, // v11 
    -0.56,  0.0,  0.0,   1.0,  1.0,  0.49,  0.0, 0,0,1, // v12
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1, // v13

    -0.56,  0.0,  0.0,   1.0,  1.0,  0.49,  0.0,  0,0,1,// v12
    -0.83,  0.5,  0.0, 1.0,   1.0,  0.75,  0.0,  0,0,1,// v1 
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36, 0,0,1,// v13

    -0.83,  0.5,  0.0, 1.0,   1.0,  0.75,  0.0,  0,0,1, // v1 
    -0.29,  0.5,  0.0, 1.0,    1.0,  0.49,  0.0, 0,0,1,// v2
    0.00,  0.0, -1.0,  1.0,   0.98,0.93,0.36,  0,0,1,// v13
  ]);
  var n = 64;    // 12 tetrahedron vertices.
  // YOU write this one...
}

function makeTri() {

   triVerts = new Float32Array([

      // Face 0: (left side)  
     0.4,  0.0, 0.0, 1.0,   0.0,  0.39, 0.0,  // Node 1
    -0.1,  1.0, 0.0, 1.0,     0.419608, 0.556863, 0.137255,   // Node 3
    -0.4,  0.0,-0.5, 1.0,     0.0,  0.4,  0.0,  // Node 0
      // Face 1: (right side)
   0.4,  0.0, 0.0, 1.0,     0.0,  0.39, 0.0,  // Node 1
    -0.4,  0.0, 0.5, 1.0,      0.678431, 1, 0.184314, // Node 2
    -0.1,  1.0, 0.0, 1.0,     0.419608, 0.556863, 0.137255,   // Node 3
      // Face 2: (lower side)
   0.4,  0.0, 0.0, 1.0,     0.0,  0.39, 0.0,  // Node 1 
    -0.4,  0.0,-0.5, 1.0,     0.0,  0.4,  0.0,  // Node 0
    -0.4,  0.0, 0.5, 1.0,      0.678431, 1, 0.184314,   // Node 2 
      // Face 3: (base side)  
    -0.4,  0.0,-0.5, 1.0,     0.0,  0.4,  0.0,  // Node 0
    -0.1,  1.0, 0.0, 1.0,       0.419608, 0.556863, 0.137255, // Node 3
    -0.4,  0.0, 0.5, 1.0,      0.678431, 1, 0.184314, // Node 2
  ]);
  var n = 12;    // 12 tetrahedron vertices.
}

function makeTetrahedron() {
  ttrVerts = new Float32Array([
    /*  Nodes:
     0.00, 0.00, 1.00, 1.00,    1.0,  1.0,  0.0,  // Node 0
     0.00, 2.00, 2.00, 1.00,    0.0,  0.0,  1.0,  // Node 1
     0.87, 2.00, 0.50, 1.00,    1.0,  0.0,  0.0,  // Node 2
    -0.87, 2.00, 0.50, 1.00,    0.0,  1.0,  0.0,  // Node 3
    */

      // Face 0
     0.00, 0.00, 1.00, 1.00,    0.0,  0.4,  0.0,  0,1,0,// Node 0
     0.00, 2.00, 2.00, 1.00,    0.0,  0.39, 0.0,  0,1,0,// Node 1
     0.87, 2.00, 0.50, 1.00,    0.678431, 1, 0.184314,  0,1,0,// Node 2
      // Face 1(front)
     0.00, 0.00, 1.00, 1.00,    0.0,  0.4,  0.0,  0,1,0,// Node 0
     0.87, 2.00, 0.50, 1.00,    0.678431, 1, 0.184314,  0,1,0,// Node 2
    -0.87, 2.00, 0.50, 1.00,    0.419608, 0.556863, 0.137255, 0,1,0,// Node 3
      // Face 2
     0.00, 0.00, 1.00, 1.00,    0.0,  0.4,  0.0,  0,1,0,// Node 0 
    -0.87, 2.00, 0.50, 1.00,    0.419608, 0.556863, 0.137255,  0,1,0,// Node 3
     0.00, 2.00, 2.00, 1.00,    0.0,  0.39, 0.0, 0,1,0,// Node 1 
      // Face 3  
    -0.87, 2.00, 0.50, 1.00,    0.419608, 0.556863, 0.137255, 0,1,0,// Node 3
     0.87, 2.00, 0.50, 1.00,    0.678431, 1, 0.184314,  0,1,0,// Node 2
     0.00, 2.00, 2.00, 1.00,    0.0,  0.39, 0.0,  0,1,0,// Node 1
    ]);
}


function makeBoard() {
   bdVerts = new Float32Array([
    -1.00,-1.00, 0.00, 1.00,     1.0, 1.0,  0.8,    0,1,0,
     1.00,-1.00, 0.00, 1.00,    0.9,  1.0,  1.0,    0,1,0,
     1.00,1.00,0.00,1.00,        1.0,0.6,0.5,       0,1,0,

     1.00, 1.00, 0.00, 1.00,    1.0,0.6,0.5,        0,1,0,
    -1.00, 1.00, 0.00, 1.00,    0.6,  1.0,  0.6,    0,1,0,  
     -1.00,-1.00, 0.00, 1.00,    1.0,  1.0,  0.8,    0,1,0,
    ]);
}


function makeBody() {
  bdyVerts = new Float32Array([
      // Former
      0,0.1,0.1,1.0,   0,0.4,0,  0,0,1,// Node 3
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  0,0,1,// Node 0
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  0,0,1,//Node 6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  0,0,1,//Node6
     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,0,1,//Node 5
     0,0.1,0.1,1.0,   0,0.4,0,  0,0,1,//Node 3
    
    // Left
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  -1,0,0,//Node 4
     -2,0.1,0.1,1.0,  0,0.8,0.8,  -1,0,0,//Node 5
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  -1,0,0,//Node6

     -2,-0.1,0.1,1.0,   0.1,0.6,1.0,  -1,0,0,//Node6
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    -1,0,0,//Node7
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  -1,0,0,//Node 4

      // Back 
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  0,0,-1,//Node 1
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,0,-1,//Node 2
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,0,-1,//Node 4

     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,0,-1,//Node 4
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,    0,0,-1,//Node7
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5,  0,0,-1,//Node 1

     //Right
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  1,0,0,//Node 0
    0,0.1,0.1,1.0,   0,0.4,0,  1,0,0,//Node 3
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  1,0,0,//Node 2

     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  1,0,0,//Node 2
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5, 1,0,0, //Node 1
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  1,0,0,//Node 0

    //Top
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,1,0,//Node 2
     0,0.1,0.1,1.0,   0,0.4,0,  0,1,0,//Node 3
     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,1,0,//Node 5

     -2,0.1,0.1,1.0,  0,0.8,0.8,  0,1,0,//Node 5
     -2,0.1,-0.1,1.0,   0.2,0.5,0.3,  0,1,0,//Node 4
     0,0.1,-0.1,1.0,    0.7,0.7,0.4,  0,1,0,//Node 2

     //Bottom
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0,  0,-1,0,//Node 0
     0,-0.1,-0.1,1.0,   0.9,0.6,0.5, 0,-1,0, //Node 1
     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,  0,-1,0, //Node7

     -2,-0.1,-0.1,1.0,  0.5,0.2,0.9,  0,-1,0,  //Node7
     -2,-0.1,0.1,1.0,   0.1,0.6,1.0, 0,-1,0, //Node6
     0,-0.1,0.1,1.0,  0.5, 0.0, 0.0, 0,-1,0, //Node 0
    ]);
}

function makeHead() {
  hdVerts = new Float32Array([

 //Former
  -0.2,-0.2,0.2,1.0, 0.96, 0.76, 0.76,  0,0,1, //Node 1
  0.2,-0.2,0.2,1.0, 0.99, 0.76, 0.8,  0,0,1,//Node 2
  0.2,0.2,0.2,1.0,  0.99, 0.76, 0.8,  0,0,1,//Node 3

  0.2,0.2,0.2,1.0,  0.99, 0.76, 0.8,  0,0,1,//Node 3
  -0.2,0.2,0.2,1.0, 0.96, 0.76, 0.76,  0,0,1,//Node 0
  -0.2,-0.2,0.2,1.0, 0.96, 0.76, 0.76,   0,0,1,//Node 1

//Right
  0.2,0.2,0.2,1.0, 0.99, 0.76, 0.8, 1,0,0, //Node 3
  0.2,-0.2,0.2,1.0, 0.99, 0.76, 0.8, 1,0,0, //Node 2
  0.2,-0.2,-0.2,1.0,  0.99, 0.76, 0.8,  1,0,0,//Node 6

  0.2,-0.2,-0.2,1.0,  0.99, 0.76, 0.8, 1,0,0, //Node 6
  0.2,0.2,-0.2,1.0, 0.99, 0.76, 0.8, 1,0,0, //Node 5
  0.2,0.2,0.2,1.0,  0.99, 0.76, 0.8,  1,0,0,//Node 3

//Back
    -0.2,0.2,-0.2,1.0,  0.96, 0.76, 0.76,   0,0,-1,//Node 4
  -0.2,-0.2,-0.2,1.0, 0.96, 0.76, 0.76,   0,0,-1,//Node 7
  0.2,-0.2,-0.2,1.0, 0.99, 0.76, 0.8, 0,0,-1,//Node 6

  0.2,-0.2,-0.2,1.0, 0.99, 0.76, 0.8, 0,0,-1,//Node 6
  0.2,0.2,-0.2,1.0, 0.99, 0.76, 0.8, 0,0,-1, //Node 5
  -0.2,0.2,-0.2,1.0,  0.96, 0.76, 0.76,   0,0,-1,//Node 4

//Left
  -0.2,0.2,0.2,1.0, 0.96, 0.76, 0.76,  -1,0,0,//Node 0
  -0.2,-0.2,0.2,1.0, 0.96, 0.76, 0.76,   -1,0,0,//Node 1
  -0.2,-0.2,-0.2,1.0, 0.96, 0.76, 0.76,   -1,0,0,//Node 7

  -0.2,-0.2,-0.2,1.0, 0.96, 0.76, 0.76,   -1,0,0,//Node 7
  -0.2,0.2,-0.2,1.0,  0.96, 0.76, 0.76,  -1,0,0, //Node 4
  -0.2,0.2,0.2,1.0, 0.96, 0.76, 0.76,   -1,0,0,//Node 0

//Top
  -0.2,0.2,0.2,1.0, 0.96, 0.76, 0.76,  0,1,0, //Node 0
  0.2,0.2,0.2,1.0, 0.99, 0.76, 0.8,  0,1,0,//Node 3
  0.2,0.2,-0.2,1.0, 0.99, 0.76, 0.8, 0,1,0,//Node 5

  0.2,0.2,-0.2,1.0, 0.99, 0.76, 0.8,  0,1,0,//Node 5
  -0.2,0.2,-0.2,1.0, 0.96, 0.76, 0.76,  0,1,0, //Node 4
  -0.2,0.2,0.2,1.0, 0.96, 0.76, 0.76,  0,1,0, //Node 0

//Bottom
  -0.2,-0.2,0.2,1.0, 0.96, 0.76, 0.76,   0,-1,0,//Node 1
  0.2,-0.2,0.2,1.0, 0.99, 0.76, 0.8,  0,-1,0,//Node 2
  0.2,-0.2,-0.2,1.0,  0.99, 0.76, 0.8,  0,-1,0,//Node 6

  0.2,-0.2,-0.2,1.0,  0.99, 0.76, 0.8, 0,-1,0,//Node 6
  -0.2,-0.2,-0.2,1.0, 0.96, 0.76, 0.76,   0,-1,0,//Node 7
  -0.2,-0.2,0.2,1.0, 0.96, 0.76, 0.76,  0,-1,0,//Node 1
  ]);
}




function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
 var topColr = new Float32Array([1, 0.854902, 0.72549]);
 var ctrColr = new Float32Array([0.7, 0.7, 0.7]); // dark gray
  // light green
 var botColr = new Float32Array([0.545098, 0.270588, 0.0745098]); // light blue
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
      cylVerts[j+3] = 1.0;      // r,g,b = topColr[]
      cylVerts[j+4]=ctrColr[0]; 
      cylVerts[j+5]=ctrColr[1]; 
      cylVerts[j+6]=ctrColr[2];
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = 1; 
    }
    else {  // put odd# vertices around the top cap's outer edge;
            // x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
            //          theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
      cylVerts[j  ] = topRadius*Math.cos(Math.PI*(v-1)/capVerts);     // x
      cylVerts[j+1] = 1.0     // y
      //  (Why not 2*PI? because 0 < =v < 2*capVerts, so we
      //   can simplify cos(2*PI * (v-1)/(2*capVerts))
      cylVerts[j+2] = topRadius*Math.sin(Math.PI*(v-1)/capVerts);;  // z
      cylVerts[j+3] = 1.0;  // w.
      // r,g,b = topColr[]
      cylVerts[j+4]=topColr[0]; 
      cylVerts[j+5]=topColr[1]; 
      cylVerts[j+6]=topColr[2];
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = 1;      
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
        cylVerts[j+3] = 1.0;  // w.
        // r,g,b = topColr[]
        cylVerts[j+4]=topColr[0]; 
        cylVerts[j+5]=topColr[1]; 
        cylVerts[j+6]=topColr[2];
        cylVerts[j+7] = 0;
        cylVerts[j+8] = 0;
        cylVerts[j+9] = 1;      
    }
    else    // position all odd# vertices along the bottom cap:
    {
        cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);   // x
        cylVerts[j+1] =-1.0 // y
        cylVerts[j+2] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);;  // z
        cylVerts[j+3] = 1.0;  // w.
        // r,g,b = topColr[]
        cylVerts[j+4]=botColr[0]; 
        cylVerts[j+5]=botColr[1]; 
        cylVerts[j+6]=botColr[2];
        cylVerts[j+7] = 0;
        cylVerts[j+8] = 0;
        cylVerts[j+9] = 1;      
    }
  }
  // Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
  // v counts the vertices in the cap; j continues to count array elements
  for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
    if(v%2==0) {  // position even #'d vertices around bot cap's outer edge
      cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);   // x
      cylVerts[j+1] =-1.0 // y
      cylVerts[j+2] = botRadius * Math.sin(Math.PI*(v)/capVerts);;  // z
      cylVerts[j+3] = 1.0;  // w.
      // r,g,b = topColr[]
      cylVerts[j+4]=botColr[0]; 
      cylVerts[j+5]=botColr[1]; 
      cylVerts[j+6]=botColr[2];
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = 1;    
    }
    else {        // position odd#'d vertices at center of the bottom cap:
      cylVerts[j  ] = 0.0;      // x,y,z,w == 0,0,-1,1
      cylVerts[j+1] =-1.0;  
      cylVerts[j+2] = 0.0; 
      cylVerts[j+3] = 1.0;      // r,g,b = botColr[]
      cylVerts[j+4]=botColr[0]; 
      cylVerts[j+5]=botColr[1]; 
      cylVerts[j+6]=botColr[2];
      cylVerts[j+7] = 0;
      cylVerts[j+8] = 0;
      cylVerts[j+9] = 1; 
    }
  }
};


function makeTorus() {
//==============================================================================

var rbend = 1.0;                    // Radius of circle formed by torus' bent bar
var rbar = 0.5;                     // radius of the bar we bent to form torus
var barSlices = 18;                 // # of bar-segments in the torus: >=3 req'd;
                                    // more segments for more-circular torus
var barSides = 13;                    // # of sides of the bar (and thus the 
                                    // number of vertices in its cross-section)
                                    // >=3 req'd;
                                    // more sides for more-circular cross-section
// for nice-looking torus with approx square facets, 
//      --choose odd or prime#  for barSides, and
//      --choose pdd or prime# for barSlices of approx. barSides *(rbend/rbar)
// EXAMPLE: rbend = 1, rbar = 0.5, barSlices =23, barSides = 11.

  // Create a (global) array to hold this torus's vertices:
 torVerts = new Float32Array(floatsPerVertex*(2*barSides*barSlices +2));
//  Each slice requires 2*barSides vertices, but 1st slice will skip its first 
// triangle and last slice will skip its last triangle. To 'close' the torus,
// repeat the first 2 vertices at the end of the triangle-strip.  Assume 7
//tangent vector with respect to big circle
  var tx = 0.0;
  var ty = 0.0;
  var tz = 0.0;
  //tangent vector with respect to small circle
  var sx = 0.0;
  var sy = 0.0;
  var sz = 0.0;
var phi=0, theta=0;                   // begin torus at angles 0,0
var thetaStep = 2*Math.PI/barSlices;  // theta angle between each bar segment
var phiHalfStep = Math.PI/barSides;   // half-phi angle between each side of bar
                                      // (WHY HALF? 2 vertices per step in phi)
  // s counts slices of the bar; v counts vertices within one slice; j counts
  // array elements (Float32) (vertices*#attribs/vertex) put in torVerts array.
  for(s=0,j=0; s<barSlices; s++) {    // for each 'slice' or 'ring' of the torus:
    for(v=0; v< 2*barSides; v++, j+=floatsPerVertex) {    // for each vertex in this slice:
      if(v%2==0)  { // even #'d vertices at bottom of slice,
        torVerts[j  ] = (rbend + rbar*Math.cos((v)*phiHalfStep)) * 
                                             Math.cos((s)*thetaStep);
                //  x = (rbend + rbar*cos(phi)) * cos(theta)
        torVerts[j+1] = (rbend + rbar*Math.cos((v)*phiHalfStep)) *
                                             Math.sin((s)*thetaStep);
                //  y = (rbend + rbar*cos(phi)) * sin(theta) 
        torVerts[j+2] = -rbar*Math.sin((v)*phiHalfStep);
                //  z = -rbar  *   sin(phi)
        torVerts[j+3] = 1.0;    // w
        //find normal
        tx = (-1) * Math.sin(s*thetaStep);
        ty = Math.cos(s*thetaStep);
        tz = 0.0;

        sx = Math.cos(s*thetaStep) * (-1) * Math.sin(v*phiHalfStep);
        sy = Math.sin(s*thetaStep) * (-1) * Math.sin(v*phiHalfStep);
        sz = (-1) * Math.cos(v*phiHalfStep);

        torVerts[j+7] = -ty*sz + tz*sy;
        torVerts[j+8] = -tz*sx + tx*sz;
        torVerts[j+9] = -tx*sy + ty*sx;
      }
      else {        // odd #'d vertices at top of slice (s+1);
                    // at same phi used at bottom of slice (v-1)
        torVerts[j  ] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) * 
                                             Math.cos((s+1)*thetaStep);
                //  x = (rbend + rbar*cos(phi)) * cos(theta)
        torVerts[j+1] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) *
                                             Math.sin((s+1)*thetaStep);
                //  y = (rbend + rbar*cos(phi)) * sin(theta) 
        torVerts[j+2] = -rbar*Math.sin((v-1)*phiHalfStep);
                //  z = -rbar  *   sin(phi)
        torVerts[j+3] = 1.0;    // w
        tx = (-1) * Math.sin((s+1)*thetaStep);
        ty = Math.cos((s+1)*thetaStep);
        tz = 0.0;

        sx = Math.cos((s+1)*thetaStep) * (-1) * Math.sin((v-1)*phiHalfStep);
        sy = Math.sin((s+1)*thetaStep) * (-1) * Math.sin((v-1)*phiHalfStep);
        sz = (-1) * Math.cos((v-1)*phiHalfStep);

        torVerts[j+7] = -ty*sz + tz*sy;
        torVerts[j+8] = -tz*sx + tx*sz;
        torVerts[j+9] = -tx*sy + ty*sx;
      }
      torVerts[j+4] = Math.random();    // random color 0.0 <= R < 1.0
      torVerts[j+5] = Math.random();    // random color 0.0 <= G < 1.0
      torVerts[j+6] = 1;    // random color 0.0 <= B < 1.0
    }
  }
  // Repeat the 1st 2 vertices of the triangle strip to complete the torus:
      torVerts[j  ] = rbend + rbar; // copy vertex zero;
              //  x = (rbend + rbar*cos(phi==0)) * cos(theta==0)
      torVerts[j+1] = 0.0;
              //  y = (rbend + rbar*cos(phi==0)) * sin(theta==0) 
      torVerts[j+2] = 0.0;
              //  z = -rbar  *   sin(phi==0)
      torVerts[j+3] = 1.0;    // w
      torVerts[j+4] = 1;    // random color 0.0 <= R < 1.0
      torVerts[j+5] = Math.random();    // random color 0.0 <= G < 1.0
      torVerts[j+6] = Math.random();    // random color 0.0 <= B < 1.0
      j+=floatsPerVertex; // go to next vertex:
      torVerts[j  ] = (rbend + rbar) * Math.cos(thetaStep);
              //  x = (rbend + rbar*cos(phi==0)) * cos(theta==thetaStep)
      torVerts[j+1] = (rbend + rbar) * Math.sin(thetaStep);
              //  y = (rbend + rbar*cos(phi==0)) * sin(theta==thetaStep) 
      torVerts[j+2] = 0.0;
              //  z = -rbar  *   sin(phi==0)
      torVerts[j+3] = 1.0;    // w
      torVerts[j+4] = Math.random();    // random color 0.0 <= R < 1.0
      torVerts[j+5] = 1;    // random color 0.0 <= G < 1.0
      torVerts[j+6] = Math.random();    // random color 0.0 <= B < 1.0
      torVerts[j+7] = 1.0;
      torVerts[j+8] = 0.0;
      torVerts[j+9] = 0.0;
}

function makeAxes(){
   axVerts = new Float32Array([
     0,0,0,1,     1.0,0.0,0.0, 0,1,0,
     1,0,0,1,     1.0, 0.0,  0.0,  0,1,0,

     0,0,0,1,     0.0,1.0,0.0,  0,0,1,
     0,1,0,1,     0.0,  1.0,  0.0,  0,0,1,

     0,0,0,1,     0.0,0.0,1.0,  1,0,0,
     0,0,1,1,     0.0,0.0,1.0,  1,0,0,
    ]);
}


// Global vars for Eye position. 
// NOTE!  I moved eyepoint BACKWARDS from the forest: from g_EyeZ=0.25
// a distance far enough away to see the whole 'forest' of trees within the
// 30-degree field-of-view of our 'perspective' camera.  I ALSO increased
// the 'keydown()' function's effect on g_EyeX position.


function draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas) {
//==============================================================================
  
  // Clear <canvas> color AND DEPTH buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, canvas.width/2, canvas.height);
  projMatrix.setPerspective(40, (0.5*canvas.width)/canvas.height, 1, 100);  
  // but use a different 'view' matrix:
  viewMatrix.setLookAt(g_EyeX, g_EyeY, g_EyeZ, // eye position
                      g_LookAtX, g_LookAtY, g_LookAtZ,                  // look-at point 
                      xx,yy,zz);                 // up vector

  if (v = change%2){
  modelMatrix.setTranslate( -0.0015*currentAngle,0, 0.02*currentAngle);
  modelMatrix.rotate(currentAngle*0.2+45, 0, 1, 0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(-15.0,0,0,1);
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,-0.2,0);
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.6,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(90.0,1,0,0);
  modelMatrix = popMatrix();
  modelMatrix.translate(0,-0.1,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0,1,0,0);
  modelMatrix.rotate(0.3*currentAngle, 0,-0.4, 1);
  modelMatrix.translate(-2.0,0,0);
  modelMatrix.rotate(0.7*currentAngle, 0, -0.4, 1);
  modelMatrix.translate(-2.0,0,0); 
  viewMatrix.setInverseOf(modelMatrix);
  modelMatrix.setIdentity();
  }
   
  // Pass the view projection matrix to our shaders: 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  // Draw the scene:
  drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle,canvas);




  gl.viewport(canvas.width/2, 0, canvas.width/2, canvas.height);
  projMatrix.setOrtho(-0.5*canvas.width/300*ll, 0.5*canvas.width/300*rr,          // left,right;
                      -1.1*canvas.height/300*bb, 1.1*canvas.height/300*tt,          // bottom, top;
                      1*nn, 100*ff);       // near, far; (always >=0)

  

  viewMatrix.setLookAt(g_EyeX, g_EyeY, g_EyeZ, // eye position
                      g_LookAtX, g_LookAtY, g_LookAtZ,                  // look-at point 
                      xx,yy, zz);

  drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle,canvas);
  
  
}


function drawMyScene(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas) {


  
  modelMatrix.setTranslate(0,0.0, 0.0);
    // 'set' means DISCARD old matrix,
              // (drawing axes centered in CVV), and then make new
              // drawing axes moved to the lower-left corner of CVV. 
  modelMatrix.scale(1,1,-1);              // convert to left-handed coord sys
                                          // to match WebGL display canvas.
  //modelMatrix.rotate(currentAngle, 0, 1, 0);

  modelMatrix.scale(0.2, 0.2, 0.2);

  
  
  
  
  
  //--------Draw Star

  
              // if you DON'T scale, tetra goes outside the CVV; clipped!
  modelMatrix.translate(-4,0.0, 0.0);
  modelMatrix.scale(1,1,-1);
  modelMatrix.rotate(3*currentAngle, 0, 0, 1);  // Make new drawing axes that
 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...
  
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex,starVerts.length/floatsPerVertex);

  modelMatrix.rotate(90.0, 0, 0, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex,starVerts.length/floatsPerVertex);


  
  modelMatrix.setTranslate(0,0.0, 0.0);  // 'set' means DISCARD old matrix,
              // (drawing axes centered in CVV), and then make new
              // drawing axes moved to the lower-left corner of CVV. 
  modelMatrix.scale(1,1,-1);              // convert to left-handed coord sys
                                          // to match WebGL display canvas.
  //modelMatrix.rotate(currentAngle, 0, 1, 0);

  modelMatrix.scale(0.2, 0.2, 0.2);
  pushMatrix(modelMatrix);
  
  
  modelMatrix.translate(4,0.0, 0.0);
  modelMatrix.scale(1,1,-1);
  modelMatrix.rotate(3*currentAngle, 0, 0, 1);  // Make new drawing axes that
 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
      // Draw just the first set of vertices: start at vertex 0...
  
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex,starVerts.length/floatsPerVertex);

  modelMatrix.rotate(90.0, 0, 0, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
      gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex,starVerts.length/floatsPerVertex);


  


  //------------Draw Legs
  modelMatrix.setTranslate( -0.0015*currentAngle,0, 0.02*currentAngle);
  modelMatrix.scale(0.7+0.002*currentAngle,0.7+0.002*currentAngle,0.7+0.002*currentAngle);
  modelMatrix.rotate(currentAngle*0.2+45, 0, 1, 0);
  //modelMatrix.translate(0,0,3);

  //modelMatrix.translate(-2.5,0,2);
  //modelMatrix.translate(0,-0.2,0);
  pushMatrix(modelMatrix);

  modelMatrix.rotate(-15.0,0,0,1);
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,-0.2,0);
  modelMatrix.scale(0.25,0.25,-0.25);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, cylStart/floatsPerVertex,cylVerts.length/floatsPerVertex);




  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(15,0,0,1);
  modelMatrix.rotate(-0.3*currentAngle, 0, 0, 1);
  modelMatrix.translate(0,-0.2,0);
  modelMatrix.scale(0.25,0.25,-0.25);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
   gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, cylStart/floatsPerVertex,cylVerts.length/floatsPerVertex);


  //-----------Draw Body
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.6,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(90.0,0,0,1);
  modelMatrix.rotate(90.0,1,0,0);
  modelMatrix.scale(0.32,-1.7,1.7);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0.8, 0.33, 0, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);



  //--------------Draw Arms
  // left arm 1
  modelMatrix = popMatrix();
  modelMatrix.translate(0,-0.1,0);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0,1,0,0);
  modelMatrix.rotate(0.3*currentAngle, 0,-0.4, 1);
  modelMatrix.scale(0.25,0.2,-0.8);
    

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);                         // apply that matrix.
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);



  // left arm 2
  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.3,0.8,-1);
  modelMatrix.rotate(0.7*currentAngle, 0, -0.4, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  // left hand
  modelMatrix.translate(-2.0,0,0); 
  modelMatrix.scale(1,1,0.5);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  // right arm 1
  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180.0, 0,1,0);
  modelMatrix.rotate(-0.3*currentAngle, 0, -0.4, 1);
  modelMatrix.scale(0.25,0.2,-0.8);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
 gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  
  
  // right arm 2
  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(0.3,0.8,-1);
  modelMatrix.rotate(-0.7*currentAngle, 0, -0.4, 1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 1, 0.89, 0.77, 1);
  gl.drawArrays(gl.TRIANGLES, bdyStart/floatsPerVertex,bdyVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  // right hand
  modelMatrix.translate(-2.0,0,0);
  modelMatrix.scale(1,1,0.5);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  //----------Draw Head
  modelMatrix = popMatrix();
  modelMatrix.translate(0,0.2,0);
  modelMatrix.scale(0.6,0.8,0.3);
  //modelMatrix.rotate(180.0,1,0,0);
  quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w); // Quaternion-->Matrix
  modelMatrix.concat(quatMatrix);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
   gl.uniform4f(u_ColorMod, 1, 0, 0, 1);
  gl.drawArrays(gl.TRIANGLES, hdStart/floatsPerVertex,hdVerts.length/floatsPerVertex);

  modelMatrix.scale(0.6,0.6,0.6);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);

  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  // Draw Torus

  modelMatrix.setTranslate(0.18,-0.3,1);
  modelMatrix.scale(0.2,0.2,-0.2);
  //modelMatrix.rotate(-90.0, 1,0,0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0.8, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, torStart/floatsPerVertex,torVerts.length/floatsPerVertex);


  // Draw gnd
  modelMatrix.setTranslate(0.0, 0.0, 0.0);
  viewMatrix.rotate(-90.0, 1,0,0);  // new one has "+z points upwards",
                                      // made by rotating -90 deg on +x-axis.
                                      // Move those new drawing axes to the 
                                      // bottom of the trees:
  viewMatrix.translate(0.0, 0.0, -0.6); 
  viewMatrix.scale(0.4, 0.4,0.4);   // shrink the drawing axes 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                gndStart/floatsPerVertex, // start at this vertex number, and
                gndVerts.length/floatsPerVertex);   // draw this many vertices


  modelMatrix.translate(-2,0.0, 0.1);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices

  modelMatrix.translate(4,0.0, 0.0);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


// Draw tree 1
  modelMatrix.setTranslate(-3,6.0, 3.0);
  modelMatrix.scale(0.9,0.9,0.9);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1);
  quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w); // Quaternion-->Matrix
  modelMatrix.concat(quatMatrix); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix.scale(2,2,2);
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.uniform4f(u_ColorMod, 0, 0, 0, 1);
  gl.drawArrays(gl.LINES,             // use this drawing primitive, and
                axStart/floatsPerVertex, // start at this vertex number, and
                axVerts.length/floatsPerVertex);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices


  // Draw tree 2
  modelMatrix.setTranslate(3,6, 3.0);
  modelMatrix.scale(0.9,0.9,0.9);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 3
  modelMatrix.setTranslate(-2,9.0, 2.8);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 4
  modelMatrix.setTranslate(2,9.0, 2.8);
  modelMatrix.scale(0.8,0.8,0.8);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 5
  modelMatrix.setTranslate(-1,12.0, 2.6);
  modelMatrix.scale(0.7,0.7,0.7);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 6
  modelMatrix.setTranslate(1,12.0, 2.6);
  modelMatrix.scale(0.7,0.7,0.7);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 7
  modelMatrix.setTranslate(-1.5,15.0, 2.6);
  modelMatrix.scale(0.7,0.7,0.7);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 8
  modelMatrix.setTranslate(1.5,15.0, 2.6);
  modelMatrix.scale(0.7,0.7,0.7);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices


  // Draw tree 9
  modelMatrix.setTranslate(-2.5,18.0, 2.4);
  modelMatrix.scale(0.6,0.6,0.6);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 10
  modelMatrix.setTranslate(2.5,18.0, 2.4);
  modelMatrix.scale(0.6,0.6,0.6);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices


  // Draw tree 11
  modelMatrix.setTranslate(-3.5,21.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 12
  modelMatrix.setTranslate(3.5,21.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 13
  modelMatrix.setTranslate(-3,24.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 14
  modelMatrix.setTranslate(3,24.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 15
  modelMatrix.setTranslate(-2,27.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 16
  modelMatrix.setTranslate(2,27.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 17
  modelMatrix.setTranslate(-1,30.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 18
  modelMatrix.setTranslate(1,30.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 19
  modelMatrix.setTranslate(-0.5,33.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices

  // Draw tree 20
  modelMatrix.setTranslate(0.5,33.0, 2.2);
  modelMatrix.scale(0.5,0.5,0.5);
  modelMatrix.rotate(15, 1, 0, 0); 
  modelMatrix.rotate(0.2*currentAngle, 0, 0, 1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices

  modelMatrix = popMatrix();
  modelMatrix.translate(0.0,0.0, -1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(1.5,1,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  gl.drawArrays(gl.TRIANGLES,             // use this drawing primitive, and
                ttrStart/10, // start at this vertex number, and
                ttrVerts.length/10);   // draw this many vertices


  modelMatrix = popMatrix();
  modelMatrix.translate(0.1,1.2, -0.2);
  modelMatrix.rotate(-90, 1, 0, 0); 
  modelMatrix.rotate(180, 0, 0, 1); 
  modelMatrix.scale(0.7,1.5,1); 
  mvpMatrix.set(projMatrix).multiply(viewMatrix).multiply(modelMatrix);
  gl.uniformMatrix4fv(u_MvpMatrix, false, mvpMatrix.elements);
  gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
  pushMatrix(modelMatrix);
  gl.drawArrays(gl.TRIANGLE_STRIP,             // use this drawing primitive, and
                cylStart/10, // start at this vertex number, and
                cylVerts.length/10);   // draw this many vertices
}


function keydown(ev, gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas,leftsigh,rightsigh) {
//------------------------------------------------------
//HTML calls this'Event handler' or 'callback function' when we press a key:

    if(ev.keyCode == 39) { // right arrow - step right
        up = new Vector3();
        up[0] = 0;
        up[1] = 1;
        up[2] = 0;
        look = new Vector3();
        look = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);

        tmpVec3 = new Vector3();
        tmpVec3 = vec3CrossProduct(up, look);

        g_EyeX -= moveStep * tmpVec3[0];
        g_EyeY -= moveStep * tmpVec3[1];
        g_EyeZ -= moveStep * tmpVec3[2];

        g_LookAtX -= moveStep * tmpVec3[0];
        g_LookAtY -= moveStep * tmpVec3[1];
        g_LookAtZ -= moveStep * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
  else 
    if (ev.keyCode == 37) { // left arrow - step left
        up = new Vector3();
        up[0] = 0;
        up[1] = 1;
        up[2] = 0;
        look = new Vector3();
        look = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);

        tmpVec3 = new Vector3();
        tmpVec3 = vec3CrossProduct(up, look);

        //console.log(tmpVec3[0], tmpVec3[1], tmpVec3[2]);

        g_EyeX += moveStep * tmpVec3[0];
        g_EyeY += moveStep * tmpVec3[1];
        g_EyeZ += moveStep * tmpVec3[2];

        g_LookAtX += moveStep * tmpVec3[0];
        g_LookAtY += moveStep * tmpVec3[1];
        g_LookAtZ += moveStep * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
  else 
    if (ev.keyCode == 38) { // up arrow - step forward
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX += moveStep * tmpVec3[0];
        g_EyeY += moveStep * tmpVec3[1];
        g_EyeZ += moveStep * tmpVec3[2];

        g_LookAtX += moveStep * tmpVec3[0];
        g_LookAtY += moveStep * tmpVec3[1];
        g_LookAtZ += moveStep * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);

    } 
    else 
    if (ev.keyCode == 40) { // down arrow - step backward
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX -= moveStep * tmpVec3[0];
        g_EyeY -= moveStep * tmpVec3[1];
        g_EyeZ -= moveStep * tmpVec3[2];

        g_LookAtX -= moveStep * tmpVec3[0];
        g_LookAtY -= moveStep * tmpVec3[1];
        g_LookAtZ -= moveStep * tmpVec3[2];

        console.log('eyeX=',g_EyeX, 'eyeY=', g_EyeY, 'eyeZ=', g_EyeZ, 'lookAtX=', g_LookAtX, 'lookAtY=', g_LookAtY, 'lookAtZ=', g_LookAtZ);
    } 
    else
    if (ev.keyCode == 65){ // a - look left
      if(update==-1 || update==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 + lookStep;
          
          update = 1;
        }
        else
        {
          THETA_NOW += lookStep;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
    }

    else
      if(ev.keyCode==68){//d - look right
        if (update==-1 || update==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 - lookStep;
          
          update = 1;
        }
        else
        {
          THETA_NOW -= lookStep;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
      }
    else
      if(ev.keyCode==87){ //w - look up
        if (update==-1 || update==1)
        {  
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          cos_theta = c / Math.sqrt(a*a + c*c);
          sin_theta = a / Math.sqrt(a*a + c*c);

          phi0 = Math.asin(b/l);

          PHI_NOW = phi0 + lookStep;
          update = 0;
        }
        else
        {
          PHI_NOW += lookStep;
        }

        g_LookAtY = l * Math.sin(PHI_NOW) + g_EyeY;
        g_LookAtX = l * Math.cos(PHI_NOW) * sin_theta + g_EyeX;
        g_LookAtZ = l * Math.cos(PHI_NOW) * cos_theta + g_EyeZ;
      }

    else
      if(ev.keyCode==83){ //s-look down
        if(update==-1 || update==1)
        { 
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
  
          cos_theta = c / Math.sqrt(a*a + c*c);
          sin_theta = a / Math.sqrt(a*a + c*c);

          phi0 = Math.asin(b/l);

          PHI_NOW = phi0 - lookStep;
          
          
          update = 0;
        }
        else
        {
          PHI_NOW -= lookStep;
        }

        g_LookAtY = l * Math.sin(PHI_NOW) + g_EyeY;
        g_LookAtX = l * Math.cos(PHI_NOW) * sin_theta + g_EyeX;
        g_LookAtZ = l * Math.cos(PHI_NOW) * cos_theta + g_EyeZ;
      }
else 
    if (ev.keyCode == 49) { // 1
        ll=ll+0.1;
    } 
else 
    if (ev.keyCode == 50) { // 2
        rr=rr+0.1;
    } 
else 
    if (ev.keyCode == 51) { // 3
        bb=bb+0.1;
    } 
else 
    if (ev.keyCode == 52) { // 4
        tt=tt+0.1;
    } 
else 
    if (ev.keyCode == 67) { // c
        change=change+1;
    } 

else 
if (ev.keyCode == 74){ // j - turn left
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX += moveStep * tmpVec3[0];
        g_EyeY += moveStep * tmpVec3[1];
        g_EyeZ += moveStep * tmpVec3[2];

      if(update==-1 || update==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 + lookStep;
          
          update = 1;
        }
        else
        {
          THETA_NOW += lookStep;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
    }

else 
if (ev.keyCode == 76){ // l - turn right
        tmpVec3 = new Vector3();
        tmpVec3 = vec3FromEye2LookAt(g_EyeX, g_EyeY, g_EyeZ, g_LookAtX, g_LookAtY, g_LookAtZ);
        
        g_EyeX += moveStep * tmpVec3[0];
        g_EyeY += moveStep * tmpVec3[1];
        g_EyeZ += moveStep * tmpVec3[2];

      if (update==-1 || update==0)
        {
          a = g_LookAtX - g_EyeX;
          b = g_LookAtY - g_EyeY;
          c = g_LookAtZ - g_EyeZ;
          l = Math.sqrt(a*a + b*b + c*c);
          lzx = Math.sqrt(a*a+c*c);
          sin_phi = lzx / l;

          theta0 = Math.PI -  Math.asin(a/lzx);

          THETA_NOW = theta0 - lookStep;
          
          update = 1;
        }
        else
        {
          THETA_NOW -= lookStep;
        }

        g_LookAtY = b + g_EyeY;
        g_LookAtX = l * sin_phi * Math.sin(THETA_NOW) + g_EyeX;
        g_LookAtZ = l * sin_phi * Math.cos(THETA_NOW) + g_EyeZ;
      }

else 
if (ev.keyCode == 85){ 
  go=go+1;// u 
  if(rightsigh == 0 && leftsigh == 0){
    leftsigh = 1;
  }
  if(rightsigh == 1 && leftsigh == 0){
    rightsigh = 0;
    angleX = 0;
    angleY = 0;
  }
     }
else 
if (ev.keyCode == 78){ //n 
    xx+=0.05;
     }
else 
if (ev.keyCode == 77){ //m
    xx-=0.05;
     }
    else { return; } // Prevent the unnecessary drawing
    draw(gl, u_MvpMatrix, u_ModelMatrix, u_NormalMatrix, u_ColorMod, currentAngle, canvas);    
}

function vec3FromEye2LookAt(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ)
{
  result = new Vector3();
  
  dx = lookAtX - eyeX;
  dy = lookAtY - eyeY;
  dz = lookAtZ - eyeZ;
  amp = Math.sqrt(dx*dx + dy*dy + dz*dz);

  result[0] = dx/amp;
  result[1] = dy/amp;
  result[2] = dz/amp;

  return result;
}

function vec3CrossProduct(up, look) //UpVec x LookVec --> Left Vec
{
  r = new Vector3();

  r[0] = up[1]*look[2] - up[2]*look[1];
  console.log('up1', up[1]);
  r[1] = up[2]*look[0] - up[0]*look[2];
  r[2] = up[0]*look[1] - up[1]*look[0];

  amp = Math.sqrt(r[0]*r[0] + r[1]*r[1] + r[2]*r[2]) + 0.000001;

  r[0] /= amp;
  r[1] /= amp;
  r[2] /= amp;

  return r;
}

var g_last = Date.now();

function animate(angle) {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;
  
  // Update the current rotation angle (adjusted by the elapsed time)
  //  limit the angle to move smoothly between +20 and -85 degrees:
if(angle >  0.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
if(angle < -180.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;
  
var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
return newAngle %= 360;
}

function resize()
{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight-100;
}

function myMouseDown(ev, gl, canvas) {
//==============================================================================
// Called when user PRESSES down any mouse button;
//                  (Which button?    console.log('ev.button='+ev.button);   )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);
//  console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
  
  isDrag = true;                      // set our mouse-dragging flag
  xMclik = x;                         // record where mouse-dragging began
  yMclik = y;
};


function myMouseMove(ev, gl, canvas) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
//                  (Which button?   console.log('ev.button='+ev.button);    )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

  if(isDrag==false) return;       // IGNORE all mouse-moves except 'dragging'

  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);

  // find how far we dragged the mouse:
  xMdragTot += (x - xMclik);          // Accumulate change-in-mouse-position,&
  yMdragTot += (y - yMclik);
  // AND use any mouse-dragging we found to update quaternions qNew and qTot.
  //===================================================
  dragQuat(x - xMclik, y - yMclik);
  //===================================================
  xMclik = x;                         // Make NEXT drag-measurement from here.
  yMclik = y;
  
  // Show it on our webpage, in the <div> element named 'MouseText':
  document.getElementById('MouseText').innerHTML=
      'Mouse Drag totals (CVV x,y coords):\t'+
       xMdragTot.toFixed(5)+', \t'+
       yMdragTot.toFixed(5);  
};

function myMouseUp(ev, gl, canvas) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
//                  (Which button?   console.log('ev.button='+ev.button);    )
//    ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//    pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect(); // get canvas corners in pixels
  var xp = ev.clientX - rect.left;                  // x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top); // y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
  // Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  /    // move origin to center of canvas and
               (canvas.width/2);      // normalize canvas to -1 <= x < +1,
  var y = (yp - canvas.height/2) /    //                     -1 <= y < +1.
               (canvas.height/2);
//  console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
  
  isDrag = false;                     // CLEAR our mouse-dragging flag, and
  // accumulate any final bit of mouse-dragging we did:
  xMdragTot += (x - xMclik);
  yMdragTot += (y - yMclik);
//  console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);

  // AND use any mouse-dragging we found to update quaternions qNew and qTot;
  dragQuat(x - xMclik, y - yMclik);

  // Show it on our webpage, in the <div> element named 'MouseText':
  /*document.getElementById('MouseText').innerHTML=
      'Mouse Drag totals (CVV x,y coords):\t'+
       xMdragTot.toFixed(5)+', \t'+
       yMdragTot.toFixed(5);  */
};

function dragQuat(xdrag, ydrag) {
//==============================================================================
// Called when user drags mouse by 'xdrag,ydrag' as measured in CVV coords.
// We find a rotation axis perpendicular to the drag direction, and convert the 
// drag distance to an angular rotation amount, and use both to set the value of 
// the quaternion qNew.  We then combine this new rotation with the current 
// rotation stored in quaternion 'qTot' by quaternion multiply.  Note the 
// 'draw()' function converts this current 'qTot' quaternion to a rotation 
// matrix for drawing. 
  var res = 5;
  var qTmp = new Quaternion(0,0,0,1);
  
  var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
  // console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
  qNew.setFromAxisAngle(-ydrag + 0.0001, xdrag + 0.0001, 0.0, dist*150.0);
  // (why add tiny 0.0001? To ensure we never have a zero-length rotation axis)
              // why axis (x,y,z) = (-yMdrag,+xMdrag,0)? 
              // -- to rotate around +x axis, drag mouse in -y direction.
              // -- to rotate around +y axis, drag mouse in +x direction.
              
  qTmp.multiply(qNew,qTot);     // apply new rotation to current rotation. 
  //--------------------------
  // IMPORTANT! Why qNew*qTot instead of qTot*qNew? (Try it!)
  // ANSWER: Because 'duality' governs ALL transformations, not just matrices. 
  // If we multiplied in (qTot*qNew) order, we would rotate the drawing axes
  // first by qTot, and then by qNew--we would apply mouse-dragging rotations
  // to already-rotated drawing axes.  Instead, we wish to apply the mouse-drag
  // rotations FIRST, before we apply rotations from all the previous dragging.
  //------------------------
  // IMPORTANT!  Both qTot and qNew are unit-length quaternions, but we store 
  // them with finite precision. While the product of two (EXACTLY) unit-length
  // quaternions will always be another unit-length quaternion, the qTmp length
  // may drift away from 1.0 if we repeat this quaternion multiply many times.
  // A non-unit-length quaternion won't work with our quaternion-to-matrix fcn.
  // Matrix4.prototype.setFromQuat().
//  qTmp.normalize();           // normalize to ensure we stay at length==1.0.
  qTot.copy(qTmp);
  // show the new quaternion qTot on our webpage in the <div> element 'QuatValue'
 /* document.getElementById('QuatValue').innerHTML= 
                             '\t X=' +qTot.x.toFixed(res)+
                            'i\t Y=' +qTot.y.toFixed(res)+
                            'j\t Z=' +qTot.z.toFixed(res)+
                            'k\t W=' +qTot.w.toFixed(res)+
                            '<br>length='+qTot.length().toFixed(res);*/
};

function testQuaternions() {
//==============================================================================
// Test our little "quaternion-mod.js" library with simple rotations for which 
// we know the answers; print results to make sure all functions work as 
// intended.
// 1)  Test constructors and value-setting functions:

  var res = 5;
  var myQuat = new Quaternion(1,2,3,4);   
    console.log('constructor: myQuat(x,y,z,w)=', 
    myQuat.x, myQuat.y, myQuat.z, myQuat.w);
  myQuat.clear();
    console.log('myQuat.clear()=', 
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), 
    myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQuat.set(1,2, 3,4);
    console.log('myQuat.set(1,2,3,4)=', 
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), 
    myQuat.z.toFixed(res), myQuat.w.toFixed(res));
    console.log('myQuat.length()=', myQuat.length().toFixed(res));
  myQuat.normalize();
    console.log('myQuat.normalize()=', 
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
    // Simplest possible quaternions:
  myQuat.setFromAxisAngle(1,0,0,0);
    console.log('Set myQuat to 0-deg. rot. on x axis=',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQuat.setFromAxisAngle(0,1,0,0);
    console.log('set myQuat to 0-deg. rot. on y axis=',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQuat.setFromAxisAngle(0,0,1,0);
    console.log('set myQuat to 0-deg. rot. on z axis=',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res), '\n');
    
  myQmat = new Matrix4();
  myQuat.setFromAxisAngle(1,0,0, 90.0); 
    console.log('set myQuat to +90-deg rot. on x axis =',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
    console.log('myQuat as matrix: (+y axis <== -z axis)(+z axis <== +y axis)');
    myQmat.printMe();
  
  myQuat.setFromAxisAngle(0,1,0, 90.0); 
    console.log('set myQuat to +90-deg rot. on y axis =',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
    console.log('myQuat as matrix: (+x axis <== +z axis)(+z axis <== -x axis)');
    myQmat.printMe();

  myQuat.setFromAxisAngle(0,0,1, 90.0); 
    console.log('set myQuat to +90-deg rot. on z axis =',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
    console.log('myQuat as matrix: (+x axis <== -y axis)(+y axis <== +x axis)');
    myQmat.printMe();

  // Test quaternion multiply: 
  // (q1*q2) should rotate drawing axes by q1 and then by q2;  it does!
  var qx90 = new Quaternion;
  var qy90 = new Quaternion;
  qx90.setFromAxisAngle(1,0,0,90.0);      // +90 deg on x axis
  qy90.setFromAxisAngle(0,1,0,90.0);      // +90 deg on y axis.
  myQuat.multiply(qx90,qy90);
    console.log('set myQuat to (90deg x axis) * (90deg y axis) = ',
    myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
  myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
  console.log('myQuat as matrix: (+x <== +z)(+y <== +x )(+z <== +y');
  myQmat.printMe();
}

