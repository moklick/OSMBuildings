// https://github.com/mattdesl/ray-plane-intersection

var Matrix = require('../src/geometry/Matrix.js');

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add(a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2]
  ];
}

function sub(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2]
  ];
}

function scale(a, b) {
  return [
    a[0] * b,
    a[1] * b,
    a[2] * b
  ];
}

function normalize(a) {
  var len = a[0]*a[0] + a[1]*a[1] + a[2]*a[2];
  if (len === 0) {
    return;
  }
  return scale(a, 1 / Math.sqrt(len));
}

//function transform3d(x, y, z, matrix) {
//  // apply matrix, see http://webglfundamentals.org/webgl/lessons/webgl-2d-matrices.html
//  var X = x*matrix[0] + y*matrix[4] + z*matrix[8] + matrix[12];
//  var Y = x*matrix[1] + y*matrix[5] + z*matrix[9] + matrix[13];
//  var Z = x*matrix[2] + y*matrix[6] + z*matrix[10] + matrix[14];
//
//  var f = 20;
//// var projection = Matrix.perspective(20, Scene.width, Scene.height, 40000);
//// matrix = Matrix.multiply(matrix, projection);
//  var zToDivideBy = z*f;
//
//  // Divide x and y by z.
//  var m = matrix;
//  var X = x*m[0] + y*m[4] + z*m[8] + m[12];
//  var Y = x*m[1] + y*m[5] + z*m[9] + m[13];
//
//  X /= Z;
//  Y /= Z;
//
//  return { x:X, y:Y };
//}

function transform(a, m) {
  // apply matrix, see http://webglfundamentals.org/webgl/lessons/webgl-2d-matrices.html
  return [
    a[0]*m[0] + a[1]*m[4] + a[2]*m[8] + m[12],
    a[0]*m[1] + a[1]*m[5] + a[2]*m[9] + m[13],
    a[0]*m[2] + a[1]*m[6] + a[2]*m[10] + m[14]
  ];
}


function intersectRayPlane(origin, direction, normal, distance) {
  var denom = dot(direction, normal);
  if (denom !== 0) {
    var t = -(dot(origin, normal) + distance) / denom;
    if (t === 0) {
      return;
    }
    return add(origin, scale(direction, t));
  }
  if (dot(normal, origin) + dist === 0) {
    return origin;
  }
}

var origin = [0, 1, -1];
var corner = [-1, -1, 0];
var direction = normalize(sub(origin, corner));

var normal = [0, 0, 1];
var distance = -2;

// distance can be determined with a second point on the plane, like so:
//var distance = -dot(normal, point)

var hit = intersectRayPlane(origin, direction, normal, distance);
//console.log(hit);

var mat = new Matrix()
  .rotateZ(90)
  .rotateX(0)
  //.multiply(Scene.perspective);

console.log(transform([ 0,  0,  0], mat.data));
console.log(transform([-1, -1,  0], mat.data));
console.log(transform([ 0,  1, -1], mat.data));
