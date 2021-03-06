
var Events = {};

(function() {

  var
    listeners = {},

    hasTouch = ('ontouchstart' in global),
    dragStartEvent = hasTouch ? 'touchstart' : 'mousedown',
    dragMoveEvent = hasTouch ? 'touchmove' : 'mousemove',
    dragEndEvent = hasTouch ? 'touchend' : 'mouseup',

    prevX = 0, prevY = 0,
    startX = 0, startY  = 0,
    startZoom = 0,
    prevRotation = 0,
    prevTilt = 0,

    button,
    stepX, stepY,

    isDisabled = false,
    pointerIsDown = false,
    resizeTimer;

  function onDragStart(e) {
    if (isDisabled || e.button > 1) {
      return;
    }

    cancelEvent(e);

    startZoom = Map.zoom;
    prevRotation = Map.rotation;
    prevTilt = Map.tilt;

    stepX = 360/innerWidth;
    stepY = 360/innerHeight;

    if (e.touches === undefined) {
      button = e.button;
    } else {
      if (e.touches.length > 1) {
        return;
      }
      e = e.touches[0];
    }

    startX = prevX = e.clientX;
    startY = prevY = e.clientY;

    pointerIsDown = true;
  }

  function onDragMove(e) {
    if (isDisabled || !pointerIsDown) {
      return;
    }

    if (e.touches !== undefined) {
      if (e.touches.length > 1) {
        return;
      }
      e = e.touches[0];
    }

    if ((e.touches !== undefined || button === 0) && !e.altKey) {
      moveMap(e);
    } else {
      prevRotation += (e.clientX - prevX)*stepX;
      prevTilt     -= (e.clientY - prevY)*stepY;
      Map.setRotation(prevRotation);
      Map.setTilt(prevTilt);
    }

    prevX = e.clientX;
    prevY = e.clientY;
  }

  function onDragEnd(e) {
    if (isDisabled || !pointerIsDown) {
      return;
    }

    if (e.touches !== undefined) {
      if (e.touches.length>1) {
        return;
      }
      e = e.touches[0];
    }

    if ((e.touches !== undefined || button === 0) && !e.altKey) {
      if (Math.abs(e.clientX-startX) < 5 && Math.abs(e.clientY-startY) < 5) {
        onClick(e);
      } else {
        moveMap(e);
      }
    } else {
      prevRotation += (e.clientX - prevX)*stepX;
      prevTilt     -= (e.clientY - prevY)*stepY;
      Map.setRotation(prevRotation);
      Map.setTilt(prevTilt);
    }

    pointerIsDown = false;
  }

  function onGestureChange(e) {
    if (isDisabled) {
      return;
    }
    cancelEvent(e);
    Map.setZoom(startZoom + (e.scale - 1));
    Map.setRotation(prevRotation - e.rotation);
//  Map.setTilt(prevTilt ...);
  }

  function onDoubleClick(e) {
    if (isDisabled) {
      return;
    }
    cancelEvent(e);
    Map.setZoom(Map.zoom + 1, e);
  }

  function onClick(e) {
    if (isDisabled) {
      return;
    }
    cancelEvent(e);
    Interaction.getFeatureID({ x:e.clientX, y:e.clientY }, function(featureID) {
      Events.emit('click', { target: { id:featureID } });
    });
  }

  function onMouseWheel(e) {
    if (isDisabled) {
      return;
    }
    cancelEvent(e);
    var delta = 0;
    if (e.wheelDeltaY) {
      delta = e.wheelDeltaY;
    } else if (e.wheelDelta) {
      delta = e.wheelDelta;
    } else if (e.detail) {
      delta = -e.detail;
    }

    var adjust = 0.2*(delta>0 ? 1 : delta<0 ? -1 : 0);
    Map.setZoom(Map.zoom + adjust, e);
  }

  //***************************************************************************

  function moveMap(e) {
    var dx = e.clientX - prevX;
    var dy = e.clientY - prevY;
    var r = rotatePoint(dx, dy, Map.rotation*Math.PI/180);
    Map.setCenter({ x:Map.center.x-r.x, y:Map.center.y-r.y });
  }

  //***************************************************************************

  Events.init = function(container) {
    addListener(container, dragStartEvent, onDragStart);
    addListener(container, 'dblclick', onDoubleClick);
    addListener(document, dragMoveEvent, onDragMove);
    addListener(document, dragEndEvent, onDragEnd);

    if (hasTouch) {
      addListener(container, 'gesturechange', onGestureChange);
    } else {
      addListener(container, 'mousewheel', onMouseWheel);
      addListener(container, 'DOMMouseScroll', onMouseWheel);
    }

    addListener(global, 'resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        // some duplication with index.js
        if (container.offsetWidth !== WIDTH || container.offsetHeight !== HEIGHT) {
          GL.canvas.width  = WIDTH  = container.offsetWidth;
          GL.canvas.height = HEIGHT = container.offsetHeight;
          Events.emit('resize');
        }
      }, 250);
    });
  };

  Events.on = function(type, fn) {
    if (!listeners[type]) {
     listeners[type] = [];
    }
    listeners[type].push(fn);
  };

  Events.off = function(type, fn) {};

  Events.emit = function(type, payload) {
    if (!listeners[type]) {
      return;
    }
    for (var i = 0, il = listeners[type].length; i<il; i++) {
      listeners[type][i](payload);
    }
  };

  Events.setDisabled = function(flag) {
    isDisabled = !!flag;
  };

  Events.isDisabled = function() {
    return !!isDisabled;
  };

  Events.destroy = function() {
    listeners = null;
  };
}());

//*****************************************************************************

function addListener(target, type, fn) {
  target.addEventListener(type, fn, false);
}

function removeListener(target, type, fn) {
  target.removeEventListener(type, fn, false);
}

function cancelEvent(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  e.returnValue = false;
}
