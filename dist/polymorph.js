(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.polymorph = {}));
}(this, function (exports) { 'use strict';

  var _ = undefined;
  var SPACE = ' ';
  var FILL = 'fill';
  var NONE = 'none';
  var DRAW_LINE_VERTICAL = 'V';
  var DRAW_LINE_HORIZONTAL = 'H';
  var DRAW_LINE = 'L';
  var CLOSE_PATH = 'Z';
  var MOVE_CURSOR = 'M';
  var DRAW_CURVE_CUBIC_BEZIER = 'C';
  var DRAW_CURVE_SMOOTH = 'S';
  var DRAW_CURVE_QUADRATIC = 'Q';
  var DRAW_CURVE_QUADRATIC_CONTINUATION = 'T';
  var DRAW_ARC = 'A';

  function isString(obj) {
      return typeof obj === 'string';
  }

  var math = Math;
  var abs = math.abs;
  var min = math.min;
  var max = math.max;
  var floor = math.floor;
  var round = math.round;
  var sqrt = math.sqrt;
  var pow = math.pow;
  var cos = math.cos;
  var asin = math.asin;
  var sin = math.sin;
  var tan = math.tan;
  var PI = math.PI;
  var QUADRATIC_RATIO = 2.0 / 3;
  var EPSILON = pow(2, -52);

  function renderPath(ns, formatter) {
      if (formatter === void 0) { formatter = round; }
      if (isString(ns)) {
          return ns;
      }
      var result = [];
      for (var i = 0; i < ns.length; i++) {
          var n = ns[i];
          result.push(MOVE_CURSOR, formatter(n[0]), formatter(n[1]), DRAW_CURVE_CUBIC_BEZIER);
          var lastResult = void 0;
          for (var f = 2; f < n.length; f += 6) {
              var p0 = formatter(n[f]);
              var p1 = formatter(n[f + 1]);
              var p2 = formatter(n[f + 2]);
              var p3 = formatter(n[f + 3]);
              var dx = formatter(n[f + 4]);
              var dy = formatter(n[f + 5]);
              var isPoint = p0 == dx && p2 == dx && p1 == dy && p3 == dy;
              if (!isPoint || lastResult !=
                  (lastResult = ('' + p0 + p1 + p2 + p3 + dx + dy))) {
                  result.push(p0, p1, p2, p3, dx, dy);
              }
          }
      }
      return result.join(SPACE);
  }

  function raiseError() {
      throw new Error(Array.prototype.join.call(arguments, SPACE));
  }

  function fillObject(dest, src) {
      for (var key in src) {
          if (!dest.hasOwnProperty(key)) {
              dest[key] = src[key];
          }
      }
      return dest;
  }

  var userAgent = typeof window !== 'undefined' && window.navigator.userAgent;
  var isEdge = /(MSIE |Trident\/|Edge\/)/i.test(userAgent);

  var arrayConstructor = isEdge ? Array : Float32Array;
  function createNumberArray(n) {
      return new arrayConstructor(n);
  }

  function fillSegments(larger, smaller, origin) {
      var largeLen = larger.length;
      var smallLen = smaller.length;
      if (largeLen < smallLen) {
          return fillSegments(smaller, larger, origin);
      }
      smaller.length = largeLen;
      for (var i = smallLen; i < largeLen; i++) {
          var l = larger[i];
          var d = createNumberArray(l.d.length);
          for (var k = 0; k < l.d.length; k += 2) {
              d[k] = origin.absolute ? origin.x : l.x + (l.w * origin.x);
              d[k + 1] = origin.absolute ? origin.y : l.y + (l.y * origin.y);
          }
          smaller[i] = fillObject({ d: d }, l);
      }
  }

  function rotatePoints(ns, count) {
      var len = ns.length;
      var rightLen = len - count;
      var buffer = createNumberArray(count);
      var i;
      for (i = 0; i < count; i++) {
          buffer[i] = ns[i];
      }
      for (i = count; i < len; i++) {
          ns[i - count] = ns[i];
      }
      for (i = 0; i < count; i++) {
          ns[rightLen + i] = buffer[i];
      }
  }

  function distance(x1, y1, x2, y2) {
      return sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
  }

  function normalizePoints(x, y, ns) {
      var len = ns.length;
      if (ns[len - 2] !== ns[0] || ns[len - 1] !== ns[1]) {
          return;
      }
      var buffer = ns.slice(2);
      len = buffer.length;
      var index, minAmount;
      for (var i = 0; i < len; i += 6) {
          var next = distance(x, y, buffer[i], buffer[i + 1]);
          if (minAmount === _ || next < minAmount) {
              minAmount = next;
              index = i;
          }
      }
      rotatePoints(buffer, index);
      ns[0] = buffer[len - 2];
      ns[1] = buffer[len - 1];
      for (var i = 0; i < buffer.length; i++) {
          ns[i + 2] = buffer[i];
      }
  }

  function fillPoints(matrix, addPoints) {
      var ilen = matrix[0].length;
      for (var i = 0; i < ilen; i++) {
          var left = matrix[0][i];
          var right = matrix[1][i];
          var totalLength = max(left.length + addPoints, right.length + addPoints);
          matrix[0][i] = fillSubpath(left, totalLength);
          matrix[1][i] = fillSubpath(right, totalLength);
      }
  }
  function fillSubpath(ns, totalLength) {
      var totalNeeded = totalLength - ns.length;
      var ratio = Math.ceil(totalNeeded / ns.length);
      var result = createNumberArray(totalLength);
      result[0] = ns[0];
      result[1] = ns[1];
      var k = 1, j = 1;
      while (j < totalLength - 1) {
          result[++j] = ns[++k];
          result[++j] = ns[++k];
          result[++j] = ns[++k];
          result[++j] = ns[++k];
          var dx = result[++j] = ns[++k];
          var dy = result[++j] = ns[++k];
          if (totalNeeded) {
              for (var f = 0; f < ratio && totalNeeded; f++) {
                  result[j + 5] = result[j + 3] = result[j + 1] = dx;
                  result[j + 6] = result[j + 4] = result[j + 2] = dy;
                  j += 6;
                  totalNeeded -= 6;
              }
          }
      }
      return result;
  }

  function sizeDesc(a, b) {
      return b.p - a.p;
  }
  function normalizePaths(left, right, options) {
      var leftPath = getSortedSegments(left);
      var rightPath = getSortedSegments(right);
      var origin = options.origin;
      var ox = origin.x;
      var oy = origin.y;
      var absolute = origin.absolute;
      if (leftPath.length !== rightPath.length) {
          if (options.optimize === FILL) {
              fillSegments(leftPath, rightPath, options.origin);
          }
          else {
              raiseError('optimize:none requires equal lengths');
          }
      }
      var matrix = Array(2);
      matrix[0] = leftPath.map(toPoints);
      matrix[1] = rightPath.map(toPoints);
      if (options.optimize !== NONE) {
          for (var i = 0; i < leftPath.length; i++) {
              var ls = leftPath[i];
              var rs = rightPath[i];
              normalizePoints(absolute ? ox : ls.x + ls.w * ox, absolute ? oy : ls.y + ls.h * oy, matrix[0][i]);
              normalizePoints(absolute ? ox : rs.x + rs.w * ox, absolute ? oy : rs.y + rs.h * oy, matrix[1][i]);
          }
      }
      if (options.optimize === FILL) {
          fillPoints(matrix, options.addPoints * 6);
      }
      return matrix;
  }
  function getSortedSegments(path) {
      return path.data.slice().sort(sizeDesc);
  }
  function toPoints(p) {
      return p.d;
  }

  var defaultOptions = {
      addPoints: 0,
      optimize: FILL,
      origin: { x: 0, y: 0 },
      precision: 0
  };
  function interpolatePath(paths, options) {
      options = fillObject(options, defaultOptions);
      if (!paths || paths.length < 2) {
          raiseError('invalid arguments');
      }
      var hlen = paths.length - 1;
      var items = Array(hlen);
      for (var h = 0; h < hlen; h++) {
          items[h] = getPathInterpolator(paths[h], paths[h + 1], options);
      }
      var formatter = !options.precision ? _ : function (n) { return n.toFixed(options.precision); };
      return function (offset) {
          var d = hlen * offset;
          var flr = min(floor(d), hlen - 1);
          return renderPath(items[flr]((d - flr) / (flr + 1)), formatter);
      };
  }
  function getPathInterpolator(left, right, options) {
      var matrix = normalizePaths(left, right, options);
      var n = matrix[0].length;
      return function (offset) {
          if (abs(offset - 0) < EPSILON) {
              return left.path;
          }
          if (abs(offset - 1) < EPSILON) {
              return right.path;
          }
          var results = Array(n);
          for (var h = 0; h < n; h++) {
              results[h] = mixPoints(matrix[0][h], matrix[1][h], offset);
          }
          return results;
      };
  }
  function mixPoints(a, b, o) {
      var alen = a.length;
      var results = createNumberArray(alen);
      for (var i = 0; i < alen; i++) {
          results[i] = a[i] + (b[i] - a[i]) * o;
      }
      return results;
  }

  function coalesce(current, fallback) {
      return current === _ ? fallback : current;
  }

  var _120 = PI * 120 / 180;
  var PI2 = PI * 2;
  function arcToCurve(x1, y1, rx, ry, angle, large, sweep, dx, dy, f1, f2, cx, cy) {
      if (rx <= 0 || ry <= 0) {
          return [x1, y1, dx, dy, dx, dy];
      }
      var rad = PI / 180 * (+angle || 0);
      var cosrad = cos(rad);
      var sinrad = sin(rad);
      var recursive = !!f1;
      if (!recursive) {
          var x1old = x1;
          var dxold = dx;
          x1 = x1old * cosrad - y1 * -sinrad;
          y1 = x1old * -sinrad + y1 * cosrad;
          dx = dxold * cosrad - dy * -sinrad;
          dy = dxold * -sinrad + dy * cosrad;
          var x = (x1 - dx) / 2;
          var y = (y1 - dy) / 2;
          var h = x * x / (rx * rx) + y * y / (ry * ry);
          if (h > 1) {
              h = sqrt(h);
              rx = h * rx;
              ry = h * ry;
          }
          var k = (large === sweep ? -1 : 1) *
              sqrt(abs((rx * rx * ry * ry - rx * rx * y * y - ry * ry * x * x) / (rx * rx * y * y + ry * ry * x * x)));
          cx = k * rx * y / ry + (x1 + dx) / 2;
          cy = k * -ry * x / rx + (y1 + dy) / 2;
          f1 = asin((y1 - cy) / ry);
          f2 = asin((dy - cy) / ry);
          if (x1 < cx) {
              f1 = PI - f1;
          }
          if (dx < cx) {
              f2 = PI - f2;
          }
          if (f1 < 0) {
              f1 += PI2;
          }
          if (f2 < 0) {
              f2 += PI2;
          }
          if (sweep && f1 > f2) {
              f1 -= PI2;
          }
          if (!sweep && f2 > f1) {
              f2 -= PI2;
          }
      }
      var res;
      if (abs(f2 - f1) > _120) {
          var f2old = f2;
          var x2old = dx;
          var y2old = dy;
          f2 = f1 + _120 * (sweep && f2 > f1 ? 1 : -1);
          dx = cx + rx * cos(f2);
          dy = cy + ry * sin(f2);
          res = arcToCurve(dx, dy, rx, ry, angle, 0, sweep, x2old, y2old, f2, f2old, cx, cy);
      }
      else {
          res = [];
      }
      var t = 4 / 3 * tan((f2 - f1) / 4);
      res.splice(0, 0, 2 * x1 - (x1 + t * rx * sin(f1)), 2 * y1 - (y1 - t * ry * cos(f1)), dx + t * rx * sin(f2), dy - t * ry * cos(f2), dx, dy);
      if (!recursive) {
          for (var i = 0, ilen = res.length; i < ilen; i += 2) {
              var xt = res[i], yt = res[i + 1];
              res[i] = xt * cosrad - yt * sinrad;
              res[i + 1] = xt * sinrad + yt * cosrad;
          }
      }
      return res;
  }

  var argLengths = { M: 2, H: 1, V: 1, L: 2, Z: 0, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  function addCurve(ctx, x1, y1, x2, y2, dx, dy) {
      var x = ctx.x;
      var y = ctx.y;
      ctx.x = coalesce(dx, x);
      ctx.y = coalesce(dy, y);
      ctx.current.push(coalesce(x1, x), (y1 = coalesce(y1, y)), (x2 = coalesce(x2, x)), (y2 = coalesce(y2, y)), ctx.x, ctx.y);
      ctx.lc = ctx.c;
  }
  function convertToAbsolute(ctx) {
      var c = ctx.c;
      var t = ctx.t;
      var x = ctx.x;
      var y = ctx.y;
      if (c === DRAW_LINE_VERTICAL) {
          t[0] += y;
      }
      else if (c === DRAW_LINE_HORIZONTAL) {
          t[0] += x;
      }
      else if (c === DRAW_ARC) {
          t[5] += x;
          t[6] += y;
      }
      else {
          for (var j = 0; j < t.length; j += 2) {
              t[j] += x;
              t[j + 1] += y;
          }
      }
  }
  function parseSegments(d) {
      return d
          .replace(/[\^\s]*([mhvlzcsqta]|\-?\d*\.?\d+)[,\$\s]*/gi, ' $1')
          .replace(/([mhvlzcsqta])/gi, ' $1')
          .trim()
          .split('  ')
          .map(parseSegment);
  }
  function parseSegment(s2) {
      return s2.split(SPACE).map(parseCommand);
  }
  function parseCommand(str, i) {
      return i === 0 ? str : +str;
  }
  function parsePoints(d) {
      var ctx = {
          x: 0,
          y: 0,
          segments: []
      };
      var segments = parseSegments(d);
      for (var i = 0; i < segments.length; i++) {
          var terms = segments[i];
          var commandLetter = terms[0];
          var command = commandLetter.toUpperCase();
          var isRelative = command !== CLOSE_PATH && command !== commandLetter;
          ctx.c = command;
          var maxLength = argLengths[command];
          var t2 = terms;
          var k = 1;
          do {
              ctx.t = t2.length === 1 ? t2 : t2.slice(k, k + maxLength);
              if (isRelative) {
                  convertToAbsolute(ctx);
              }
              var n = ctx.t;
              var x = ctx.x;
              var y = ctx.y;
              var x1 = void 0, y1 = void 0, dx = void 0, dy = void 0, x2 = void 0, y2 = void 0;
              if (command === MOVE_CURSOR) {
                  ctx.segments.push((ctx.current = [(ctx.x = n[0]), (ctx.y = n[1])]));
              }
              else if (command === DRAW_LINE_HORIZONTAL) {
                  addCurve(ctx, _, _, _, _, n[0], _);
              }
              else if (command === DRAW_LINE_VERTICAL) {
                  addCurve(ctx, _, _, _, _, _, n[0]);
              }
              else if (command === DRAW_LINE) {
                  addCurve(ctx, _, _, _, _, n[0], n[1]);
              }
              else if (command === CLOSE_PATH) {
                  addCurve(ctx, _, _, _, _, ctx.current[0], ctx.current[1]);
              }
              else if (command === DRAW_CURVE_CUBIC_BEZIER) {
                  addCurve(ctx, n[0], n[1], n[2], n[3], n[4], n[5]);
                  ctx.cx = n[2];
                  ctx.cy = n[3];
              }
              else if (command === DRAW_CURVE_SMOOTH) {
                  var isInitialCurve = ctx.lc !== DRAW_CURVE_SMOOTH && ctx.lc !== DRAW_CURVE_CUBIC_BEZIER;
                  x1 = isInitialCurve ? _ : x * 2 - ctx.cx;
                  y1 = isInitialCurve ? _ : y * 2 - ctx.cy;
                  addCurve(ctx, x1, y1, n[0], n[1], n[2], n[3]);
                  ctx.cx = n[0];
                  ctx.cy = n[1];
              }
              else if (command === DRAW_CURVE_QUADRATIC) {
                  var cx1 = n[0];
                  var cy1 = n[1];
                  dx = n[2];
                  dy = n[3];
                  addCurve(ctx, x + (cx1 - x) * QUADRATIC_RATIO, y + (cy1 - y) * QUADRATIC_RATIO, dx + (cx1 - dx) * QUADRATIC_RATIO, dy + (cy1 - dy) * QUADRATIC_RATIO, dx, dy);
                  ctx.cx = cx1;
                  ctx.cy = cy1;
              }
              else if (command === DRAW_CURVE_QUADRATIC_CONTINUATION) {
                  dx = n[0];
                  dy = n[1];
                  if (ctx.lc === DRAW_CURVE_QUADRATIC || ctx.lc === DRAW_CURVE_QUADRATIC_CONTINUATION) {
                      x1 = x + (x * 2 - ctx.cx - x) * QUADRATIC_RATIO;
                      y1 = y + (y * 2 - ctx.cy - y) * QUADRATIC_RATIO;
                      x2 = dx + (x * 2 - ctx.cx - dx) * QUADRATIC_RATIO;
                      y2 = dy + (y * 2 - ctx.cy - dy) * QUADRATIC_RATIO;
                  }
                  else {
                      x1 = x2 = x;
                      y1 = y2 = y;
                  }
                  addCurve(ctx, x1, y1, x2, y2, dx, dy);
                  ctx.cx = x2;
                  ctx.cy = y2;
              }
              else if (command === DRAW_ARC) {
                  var beziers = arcToCurve(x, y, n[0], n[1], n[2], n[3], n[4], n[5], n[6]);
                  for (var j = 0; j < beziers.length; j += 6) {
                      addCurve(ctx, beziers[j], beziers[j + 1], beziers[j + 2], beziers[j + 3], beziers[j + 4], beziers[j + 5]);
                  }
              }
              else {
                  raiseError(ctx.c, ' is not supported');
              }
              k += maxLength;
          } while (k < t2.length);
      }
      return ctx.segments;
  }

  function perimeterPoints(pts) {
      var n = pts.length;
      var x2 = pts[n - 2];
      var y2 = pts[n - 1];
      var p = 0;
      for (var i = 0; i < n; i += 6) {
          p += distance(pts[i], pts[i + 1], x2, y2);
          x2 = pts[i];
          y2 = pts[i + 1];
      }
      return floor(p);
  }

  function createPathSegmentArray(points) {
      var xmin = points[0];
      var ymin = points[1];
      var ymax = ymin;
      var xmax = xmin;
      for (var i = 2; i < points.length; i += 6) {
          var x = points[i + 4];
          var y = points[i + 5];
          xmin = min(xmin, x);
          xmax = max(xmax, x);
          ymin = min(ymin, y);
          ymax = max(ymax, y);
      }
      return {
          d: points,
          x: xmin,
          y: ymin,
          w: xmax - xmin,
          h: ymax - ymin,
          p: perimeterPoints(points)
      };
  }
  function parsePath(d) {
      return {
          path: d,
          data: parsePoints(d).map(createPathSegmentArray)
      };
  }

  var selectorRegex = /^([#|\.]|path)/i;
  function getPath(selector) {
      if (isString(selector)) {
          if (!selectorRegex.test(selector)) {
              return selector;
          }
          selector = document.querySelector(selector);
      }
      return selector.getAttribute('d');
  }

  function parse(d) {
      return parsePath(getPath(d));
  }

  function interpolate(paths, options) {
      return interpolatePath(paths.map(parse), options || {});
  }

  exports.interpolate = interpolate;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
