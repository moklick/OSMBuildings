

var activities = [];

function setBusy(key) {
  if (!activities.length) {
    Events.emit('busy');
  }
  if (activities.indexOf(key) === -1) {
    activities.push(key);
  }
}

function setIdle(key) {
  if (!activities.length) {
    return;
  }
  var i = activities.indexOf(key);
  if (i > -1) {
    activities.splice(i, 1);
  }
  if (!activities.length) {
    Events.emit('idle');
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(value, min));
}

function normalize(value, min, max) {
  var range = max-min;
  return clamp((value-min)/range, 0, 1);
}

function adjust(inValue, style, inProperty, outProperty) {
  var min = style.min, max = style.max;
  var normalized = normalize(inValue, min[inProperty], max[inProperty]);
  return min[outProperty] + (max[outProperty]-min[outProperty]) * normalized;
}

function project(latitude, longitude, worldSize) {
  var
    x = longitude/360 + 0.5,
    y = Math.min(1, Math.max(0, 0.5 - (Math.log(Math.tan((Math.PI/4) + (Math.PI/2)*latitude/180)) / Math.PI) / 2));
  return { x: x*worldSize, y: y*worldSize };
}

function unproject(x, y, worldSize) {
  x /= worldSize;
  y /= worldSize;
  return {
    latitude: (2 * Math.atan(Math.exp(Math.PI * (1 - 2*y))) - Math.PI/2) * (180/Math.PI),
    longitude: x*360 - 180
  };
}

function pattern(str, param) {
  return str.replace(/\{(\w+)\}/g, function(tag, key) {
    return param[key] || tag;
  });
}
