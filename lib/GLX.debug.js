var glx = (function(global) {
var glx = {};

var GL;

glx.View = function(container, width, height) {

  var canvas = document.createElement('CANVAS');
  canvas.style.position = 'absolute';
  canvas.width = width;
  canvas.height = height;
  container.appendChild(canvas);

  var options = {
    antialias: true,
    depth: true,
    premultipliedAlpha: false
  };

  try {
    GL = canvas.getContext('webgl', options);
  } catch (ex) {}
  if (!GL) {
    try {
      GL = canvas.getContext('experimental-webgl', options);
    } catch (ex) {}
  }
  if (!GL) {
    throw new Error('WebGL not supported');
  }

  //canvas.addEventListener('webglcontextlost', function(e) {});
  //canvas.addEventListener('webglcontextrestored', function(e) {});

  GL.viewport(0, 0, width, height);
  GL.cullFace(GL.BACK);
  GL.enable(GL.CULL_FACE);
  GL.enable(GL.DEPTH_TEST);
  GL.clearColor(0.5, 0.5, 0.5, 1);

  return GL;
};

glx.start = function(render) {
  return setInterval(function() {
    requestAnimationFrame(render);
  }, 17);
};

glx.stop = function(loop) {
  clearInterval(loop);
};

glx.destroy = function(GL) {
  GL.canvas.parentNode.removeChild(GL.canvas);
  GL.canvas = null;
};


glx.util = {};

glx.util.nextPowerOf2 = function(n) {
  n--;
  n |= n >> 1;  // handle  2 bit numbers
  n |= n >> 2;  // handle  4 bit numbers
  n |= n >> 4;  // handle  8 bit numbers
  n |= n >> 8;  // handle 16 bit numbers
  n |= n >> 16; // handle 32 bit numbers
  n++;
  return n;
};

glx.util.calcNormal = function(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var d1x = ax-bx;
  var d1y = ay-by;
  var d1z = az-bz;

  var d2x = bx-cx;
  var d2y = by-cy;
  var d2z = bz-cz;

  var nx = d1y*d2z - d1z*d2y;
  var ny = d1z*d2x - d1x*d2z;
  var nz = d1x*d2y - d1y*d2x;

  return this.calcUnit(nx, ny, nz);
};

glx.util.calcUnit = function(x, y, z) {
  var m = Math.sqrt(x*x + y*y + z*z);

  if (m === 0) {
    m = 0.00001;
  }

  return [x/m, y/m, z/m];
};


glx.Buffer = function(itemSize, data) {
  this.id = GL.createBuffer();
  this.itemSize = itemSize;
  this.numItems = data.length/itemSize;
  GL.bindBuffer(GL.ARRAY_BUFFER, this.id);
  GL.bufferData(GL.ARRAY_BUFFER, data, GL.STATIC_DRAW);
  data = null;
};

glx.Buffer.prototype = {
  enable: function() {
    GL.bindBuffer(GL.ARRAY_BUFFER, this.id);
  },

  destroy: function() {
    GL.deleteBuffer(this.id);
  }
};


glx.Framebuffer = function(width, height) {
  this.setSize(width, height);
};

glx.Framebuffer.prototype = {

  setSize: function(width, height) {
    this.frameBuffer = GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);

    this.width  = width;
    this.height = height;
    var size = glx.util.nextPowerOf2(Math.max(this.width, this.height));

    this.renderBuffer = GL.createRenderbuffer();
    GL.bindRenderbuffer(GL.RENDERBUFFER, this.renderBuffer);
    GL.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH_COMPONENT16, size, size);

    if (this.renderTexture) {
      this.renderTexture.destroy();
    }

    this.renderTexture = new glx.Texture({ size:size });

    GL.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.DEPTH_ATTACHMENT, GL.RENDERBUFFER, this.renderBuffer);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.renderTexture.id, 0); ////////

    if (GL.checkFramebufferStatus(GL.FRAMEBUFFER) !== GL.FRAMEBUFFER_COMPLETE) {
      throw new Error('This combination of framebuffer attachments does not work');
    }

    GL.bindRenderbuffer(GL.RENDERBUFFER, null);
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);
  },

  enable: function() {
    GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
    GL.bindRenderbuffer(GL.RENDERBUFFER, this.renderBuffer);
  },

  disable: function() {
    GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    GL.bindRenderbuffer(GL.RENDERBUFFER, null);
  },

  getData: function() {
    var imageData = new Uint8Array(this.width*this.height*4);
    GL.readPixels(0, 0, this.width, this.height, GL.RGBA, GL.UNSIGNED_BYTE, imageData);
    return imageData;
  },

  destroy: function() {
    if (this.renderTexture) {
      this.renderTexture.destroy();
    }
  }
};


glx.Shader = function(config) {
  this.id = GL.createProgram();

  this.attach(GL.VERTEX_SHADER,   config.vertexShader);
  this.attach(GL.FRAGMENT_SHADER, config.fragmentShader);

  GL.linkProgram(this.id);

  if (!GL.getProgramParameter(this.id, GL.LINK_STATUS)) {
    throw new Error(GL.getProgramParameter(this.id, GL.VALIDATE_STATUS) +'\n'+ GL.getError());
  }

  this.attributeNames = config.attributes;
  this.uniformNames   = config.uniforms;

  if (config.framebuffer) {
    this.framebuffer = new glx.Framebuffer();
  }
};

glx.Shader.prototype = {

  locateAttribute: function(name) {
    var loc = GL.getAttribLocation(this.id, name);
    if (loc < 0) {
      console.error('unable to locate attribute "'+ name +'" in shader');
      return;
    }
    GL.enableVertexAttribArray(loc);
    this.attributes[name] = loc;
  },

  locateUniform: function(name) {
    var loc = GL.getUniformLocation(this.id, name);
    if (loc < 0) {
      console.error('unable to locate uniform "'+ name +'" in shader');
      return;
    }
    this.uniforms[name] = loc;
  },

  attach: function(type, src) {
    var shader = GL.createShader(type);
    GL.shaderSource(shader, src);
    GL.compileShader(shader);

    if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
      throw new Error(GL.getShaderInfoLog(shader));
    }

    GL.attachShader(this.id, shader);
  },

  enable: function() {
    GL.useProgram(this.id);

    var i;

    if (this.attributeNames) {
      this.attributes = {};
      for (i = 0; i < this.attributeNames.length; i++) {
        this.locateAttribute(this.attributeNames[i]);
      }
    }

    if (this.uniformNames) {
      this.uniforms = {};
      for (i = 0; i < this.uniformNames.length; i++) {
        this.locateUniform(this.uniformNames[i]);
      }
    }

    if (this.framebuffer) {
      this.framebuffer.enable();
    }

    return this;
  },

  disable: function() {
    if (this.attributes) {
      for (var name in this.attributes) {
        GL.disableVertexAttribArray(this.attributes[name]);
      }
    }

    this.attributes = null;
    this.uniforms = null;

    if (this.framebuffer) {
      this.framebuffer.disable();
    }
  }
};


glx.Matrix = function(data) {
  if (data) {
    this.data = new Float32Array(data);
  } else {
    this.identity();
  }
};

(function() {

  function rad(a) {
    return a * Math.PI/180;
  }

  function multiply(a, b) {
    var
      a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3],
      a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7],
      a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11],
      a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15],

      b00 = b[0],
      b01 = b[1],
      b02 = b[2],
      b03 = b[3],
      b10 = b[4],
      b11 = b[5],
      b12 = b[6],
      b13 = b[7],
      b20 = b[8],
      b21 = b[9],
      b22 = b[10],
      b23 = b[11],
      b30 = b[12],
      b31 = b[13],
      b32 = b[14],
      b33 = b[15];

    return new Float32Array([
      a00*b00 + a01*b10 + a02*b20 + a03*b30,
      a00*b01 + a01*b11 + a02*b21 + a03*b31,
      a00*b02 + a01*b12 + a02*b22 + a03*b32,
      a00*b03 + a01*b13 + a02*b23 + a03*b33,

      a10*b00 + a11*b10 + a12*b20 + a13*b30,
      a10*b01 + a11*b11 + a12*b21 + a13*b31,
      a10*b02 + a11*b12 + a12*b22 + a13*b32,
      a10*b03 + a11*b13 + a12*b23 + a13*b33,

      a20*b00 + a21*b10 + a22*b20 + a23*b30,
      a20*b01 + a21*b11 + a22*b21 + a23*b31,
      a20*b02 + a21*b12 + a22*b22 + a23*b32,
      a20*b03 + a21*b13 + a22*b23 + a23*b33,

      a30*b00 + a31*b10 + a32*b20 + a33*b30,
      a30*b01 + a31*b11 + a32*b21 + a33*b31,
      a30*b02 + a31*b12 + a32*b22 + a33*b32,
      a30*b03 + a31*b13 + a32*b23 + a33*b33
    ]);
  }

  glx.Matrix.prototype = {

    identity: function() {
      this.data = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      return this;
    },

    multiply: function(m) {
      this.data = multiply(this.data, m.data);
      return this;
    },

    translate: function(x, y, z) {
      this.data = multiply(this.data, [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
      ]);
      return this;
    },

    rotateX: function(angle) {
      var a = rad(angle), c = Math.cos(a), s = Math.sin(a);
      this.data = multiply(this.data, [
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
      ]);
      return this;
    },

    rotateY: function(angle) {
      var a = rad(angle), c = Math.cos(a), s = Math.sin(a);
      this.data = multiply(this.data, [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
      ]);
      return this;
    },

    rotateZ: function(angle) {
      var a = rad(angle), c = Math.cos(a), s = Math.sin(a);
      this.data = multiply(this.data, [
        c, -s, 0, 0,
        s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      return this;
    },

    scale: function(x, y, z) {
      this.data = multiply(this.data, [
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
      ]);
      return this;
    }
  };

  glx.Matrix.multiply = function(a, b) {
    return multiply(a.data, b.data);
  };

  glx.Matrix.Perspective = function(fov, aspect, near, far) {
    var f = 1/Math.tan(fov*(Math.PI/180)/2), nf = 1/(near - far);
    return new glx.Matrix([
      f/aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near)*nf, -1,
      0, 0, (2*far*near)*nf, 0
    ]);
  };

  glx.Matrix.invert3 = function(a) {
    var
      a00 = a[0], a01 = a[1], a02 = a[2],
      a04 = a[4], a05 = a[5], a06 = a[6],
      a08 = a[8], a09 = a[9], a10 = a[10],

      l =  a10 * a05 - a06 * a09,
      o = -a10 * a04 + a06 * a08,
      m =  a09 * a04 - a05 * a08,

      det = a00*l + a01*o + a02*m;

    if (!det) {
      return null;
    }

    det = 1.0/det;

    return [
      l                    * det,
      (-a10*a01 + a02*a09) * det,
      ( a06*a01 - a02*a05) * det,
      o                    * det,
      ( a10*a00 - a02*a08) * det,
      (-a06*a00 + a02*a04) * det,
      m                    * det,
      (-a09*a00 + a01*a08) * det,
      ( a05*a00 - a01*a04) * det
    ];
  };

  glx.Matrix.transpose = function(a) {
    return new Float32Array([
      a[0],
      a[3],
      a[6],
      a[1],
      a[4],
      a[7],
      a[2],
      a[5],
      a[8]
    ]);
  };

  // glx.Matrix.transform = function(x, y, z, m) {
  //   var X = x*m[0] + y*m[4] + z*m[8]  + m[12];
  //   var Y = x*m[1] + y*m[5] + z*m[9]  + m[13];
  //   var Z = x*m[2] + y*m[6] + z*m[10] + m[14];
  //   var W = x*m[3] + y*m[7] + z*m[11] + m[15];
  //   return {
  //     x: (X/W +1) / 2,
  //     y: (Y/W +1) / 2
  //   };
  // };

  glx.Matrix.transform = function(m) {
    var X = m[12];
    var Y = m[13];
    var W = m[15];
    return {
      x: (X/W +1) / 2,
      y: (Y/W +1) / 2
    };
  };

}());


glx.Texture = function(options) {
  options = options || {};

  this.id = GL.createTexture();
  GL.bindTexture(GL.TEXTURE_2D, this.id);

  if (options.size) {
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, options.size, options.size, 0, GL.RGBA, GL.UNSIGNED_BYTE, null);
  } else {
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, options.filter || GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_NEAREST);
//  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
//  GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);

    if (options.image) {
      this.setImage(options.image);
    }

    GL.bindTexture(GL.TEXTURE_2D, null);
  }
};

glx.Texture.prototype = {
  enable: function(index) {
    GL.bindTexture(GL.TEXTURE_2D, this.id);
    GL.activeTexture(GL.TEXTURE0 + (index || 0));
  },

  disable: function() {
    GL.bindTexture(GL.TEXTURE_2D, null);
  },

  load: function(url, callback) {
    var image = this.image = new Image();
    image.crossOrigin = '*';
    image.onload = function() {
      // TODO: do this only once
      var maxTexSize = GL.getParameter(GL.MAX_TEXTURE_SIZE);
      if (image.width > maxTexSize || image.height > maxTexSize) {
        var w = maxTexSize, h = maxTexSize;
        var ratio = image.width/image.height;
        // TODO: if other dimension doesn't fit to POT after resize, there is still trouble
        if (ratio < 1) {
          w = Math.round(h*ratio);
        } else {
          h = Math.round(w/ratio);
        }

        var canvas = document.createElement('CANVAS');
        canvas.width  = w;
        canvas.height = h;

        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        image = canvas;
      }

      this.setImage(image);
      this.isLoaded = true;

      if (callback) {
        callback(image);
      }

    }.bind(this);

    image.onerror = function() {
      if (callback) {
        callback();
      }
    };

    image.src = url;
  },

  setImage: function(image) {
    GL.bindTexture(GL.TEXTURE_2D, this.id);
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, image);
    GL.generateMipmap(GL.TEXTURE_2D);
    image = null;
  },

  destroy: function() {
    GL.bindTexture(GL.TEXTURE_2D, null);
    GL.deleteTexture(this.id);
    if (this.image) {
      this.isLoaded = null;
      this.image.src = '';
      this.image = null;
    }
  }
};


glx.mesh = {};


glx.mesh.addQuad = function(data, a, b, c, d, color) {
  this.addTriangle(data, a, b, c, color);
  this.addTriangle(data, c, d, a, color);
};

glx.mesh.addTriangle = function(data, a, b, c, color) {
  data.vertices.push(
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    c[0], c[1], c[2]
  );

  var n = glx.util.calcNormal(
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    c[0], c[1], c[2]
  );

  data.normals.push(
    n[0], n[1], n[2],
    n[0], n[1], n[2],
    n[0], n[1], n[2]
  );

  data.colors.push(
    color[0], color[1], color[2], color[3],
    color[0], color[1], color[2], color[3],
    color[0], color[1], color[2], color[3]
  );
};


glx.mesh.Triangle = function(size, color) {

  var data = {
    vertices: [],
    normals: [],
    colors: []
  };

  var a = [-size/2, -size/2, 0];
  var b = [ size/2, -size/2, 0];
  var c = [ size/2,  size/2, 0];

  glx.mesh.addTriangle(data, a, b, c, color);

  this.vertexBuffer = new glx.Buffer(3, new Float32Array(data.vertices));
  this.normalBuffer = new glx.Buffer(3, new Float32Array(data.normals));
  this.colorBuffer  = new glx.Buffer(4, new Float32Array(data.colors));

 	this.transform = new glx.Matrix();
};


glx.mesh.Plane = function(size, color) {

  var data = {
    vertices: [],
    normals: [],
    colors: []
  };

  var a = [-size/2, -size/2, 0];
  var b = [ size/2, -size/2, 0];
  var c = [ size/2,  size/2, 0];
  var d = [-size/2,  size/2, 0];

  glx.mesh.addQuad(data, a, b, c, d, color);

  this.vertexBuffer = new glx.Buffer(3, new Float32Array(data.vertices));
  this.normalBuffer = new glx.Buffer(3, new Float32Array(data.normals));
  this.colorBuffer  = new glx.Buffer(4, new Float32Array(data.colors));

 	this.transform = new glx.Matrix();
};


glx.mesh.Cube = function(size, color) {

  var data = {
    vertices: [],
    normals: [],
    colors: []
  };

  var a = [-size/2, -size/2, -size/2];
  var b = [ size/2, -size/2, -size/2];
  var c = [ size/2,  size/2, -size/2];
  var d = [-size/2,  size/2, -size/2];

  var A = [-size/2, -size/2, size/2];
  var B = [ size/2, -size/2, size/2];
  var C = [ size/2,  size/2, size/2];
  var D = [-size/2,  size/2, size/2];

  glx.mesh.addQuad(data, a, b, c, d, color);
  glx.mesh.addQuad(data, A, B, C, D, color);
  glx.mesh.addQuad(data, a, b, B, A, color);
  glx.mesh.addQuad(data, b, c, C, B, color);
  glx.mesh.addQuad(data, c, d, D, C, color);
  glx.mesh.addQuad(data, d, a, A, D, color);

  this.vertexBuffer = new glx.Buffer(3, new Float32Array(data.vertices));
  this.normalBuffer = new glx.Buffer(3, new Float32Array(data.normals));
  this.colorBuffer  = new glx.Buffer(4, new Float32Array(data.colors));

  this.transform = new glx.Matrix();
};

return glx;
}(this));