var polymorph = (function (exports) {
'use strict';

function isString(obj) {
    return typeof obj === 'string';
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

var _ = undefined;
var V = 'V';
var H = 'H';
var Z = 'Z';
var M = 'M';
var C = 'C';
var S = 'S';
var Q = 'Q';
var T = 'T';

var EPSILON = Math.pow(2, -52);
var abs = Math.abs;
var min = Math.min;
var max = Math.max;
var floor = Math.floor;

function renderPath(ns) {
    if (isString(ns)) {
        return ns;
    }
    var parts = [];
    for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        parts.push(M, formatNumber(n[0]), formatNumber(n[1]), C);
        for (var f = 2; f < n.length; f++) {
            parts.push(formatNumber(n[f]));
        }
    }
    return parts.join(' ');
}
function formatNumber(n) {
    return (floor(n * 100) / 100).toString();
}

function raiseError() {
    throw new Error(Array.prototype.join.call(arguments, ' '));
}

function morphPath(paths) {
    if (!paths || paths.length < 2) {
        raiseError('invalid arguments');
    }
    var items = [];
    for (var h = 0; h < paths.length - 1; h++) {
        items.push(getPathInterpolator(paths[h], paths[h + 1]));
    }
    var len = items.length;
    return function (offset) {
        var d = len * offset;
        var flr = min(floor(d), len - 1);
        return renderPath(items[flr]((d - flr) / (flr + 1)));
    };
}
function getPathInterpolator(left, right) {
    var leftPath = left.data.slice();
    var rightPath = right.data.slice();
    if (leftPath.length !== rightPath.length) {
        fillSegments(leftPath, rightPath);
    }
    var leftSegment = leftPath.map(selectPath);
    var rightSegment = rightPath.map(selectPath);
    var length = leftSegment.length;
    for (var i = 0; i < length; i++) {
        fillPoints(leftSegment[i], rightSegment[i]);
    }
    return function (offset) {
        if (abs(offset - 0) < EPSILON) {
            return left.path;
        }
        if (abs(offset - 1) < EPSILON) {
            return right.path;
        }
        return mixPointArrays(leftSegment, rightSegment, offset);
    };
}
function selectPath(s) {
    return s.d.slice();
}
function mixPointArrays(l, r, o) {
    return l.map(function (a, h) { return mixPoints(a, r[h], o); });
}
function fillSegments(larger, smaller) {
    if (larger.length < smaller.length) {
        return fillSegments(smaller, larger);
    }
    for (var i = smaller.length; i < larger.length; i++) {
        var l = larger[i];
        var x = l.w / 2 + l.x;
        var y = l.h / 2 + l.y;
        var s = { d: [], x: l.x, y: l.y, h: l.h, w: l.w };
        for (var k = 0; k < l.d.length; k += 2) {
            s.d.push(x, y);
        }
        smaller.push(s);
    }
}
function fillPoints(larger, smaller) {
    if (larger.length < smaller.length) {
        return fillPoints(smaller, larger);
    }
    var numberInSmaller = (smaller.length - 2) / 6;
    var numberInLarger = (larger.length - 2) / 6;
    var numberToInsert = numberInLarger - numberInSmaller;
    if (numberToInsert === 0) {
        return;
    }
    var dist = numberToInsert / numberInLarger;
    for (var i = 0; i < numberToInsert; i++) {
        var index = min(floor(dist * i * 6) + 2, smaller.length);
        var x = smaller[index - 2];
        var y = smaller[index - 1];
        smaller.splice(index, 0, x, y, x, y, x, y);
    }
}
function mixPoints(a, b, o) {
    var results = [];
    for (var i = 0; i < a.length; i++) {
        results.push(a[i] + (b[i] - a[i]) * o);
    }
    return results;
}

function coalesce(current, fallback) {
    return current === _ ? fallback : current;
}

var argLengths = { M: 2, H: 1, V: 1, L: 2, Z: 0, C: 6, S: 4, Q: 4, T: 2 };
var quadraticRatio = 2.0 / 3;
function m(ctx) {
    var n = ctx.t;
    addSegment(ctx, n[0], n[1]);
}
function h(ctx) {
    addCurve(ctx, _, _, _, _, ctx.t[0], _);
}
function v(ctx) {
    addCurve(ctx, _, _, _, _, _, ctx.t[0]);
}
function l(ctx) {
    var n = ctx.t;
    addCurve(ctx, _, _, _, _, n[0], n[1]);
}
function z(ctx) {
    addCurve(ctx, _, _, _, _, ctx.p[0], ctx.p[1]);
}
function c(ctx) {
    var n = ctx.t;
    addCurve(ctx, n[0], n[1], n[2], n[3], n[4], n[5]);
    ctx.cx = n[2];
    ctx.cy = n[3];
}
function s(ctx) {
    var n = ctx.t;
    var isInitialCurve = ctx.lc !== S && ctx.lc !== C;
    var x1 = isInitialCurve ? _ : ctx.x * 2 - ctx.cx;
    var y1 = isInitialCurve ? _ : ctx.y * 2 - ctx.cy;
    addCurve(ctx, x1, y1, n[0], n[1], n[2], n[3]);
    ctx.cx = n[0];
    ctx.cy = n[1];
}
function q(ctx) {
    var n = ctx.t;
    var cx1 = n[0];
    var cy1 = n[1];
    var dx = n[2];
    var dy = n[3];
    addCurve(ctx, ctx.x + (cx1 - ctx.x) * quadraticRatio, ctx.y + (cy1 - ctx.y) * quadraticRatio, dx + (cx1 - dx) * quadraticRatio, dy + (cy1 - dy) * quadraticRatio, dx, dy);
    ctx.cx = cx1;
    ctx.cy = cy1;
}
function t(ctx) {
    var n = ctx.t;
    var dx = n[0];
    var dy = n[1];
    var x1, y1, x2, y2;
    if (ctx.lc === Q || ctx.lc === T) {
        var cx1 = ctx.x * 2 - ctx.cx;
        var cy1 = ctx.y * 2 - ctx.cy;
        x1 = ctx.x + (cx1 - ctx.x) * quadraticRatio;
        y1 = ctx.y + (cy1 - ctx.y) * quadraticRatio;
        x2 = dx + (cx1 - dx) * quadraticRatio;
        y2 = dy + (cy1 - dy) * quadraticRatio;
    }
    else {
        x1 = x2 = ctx.x;
        y1 = y2 = ctx.y;
    }
    addCurve(ctx, x1, y1, x2, y2, dx, dy);
    ctx.cx = x2;
    ctx.cy = y2;
}
var parsers = {
    M: m,
    H: h,
    V: v,
    L: l,
    Z: z,
    C: c,
    S: s,
    Q: q,
    T: t
};
function addSegment(ctx, x, y) {
    ctx.x = x;
    ctx.y = y;
    var p = [x, y];
    ctx.s.push(p);
    ctx.p = p;
}
function addCurve(ctx, x1, y1, x2, y2, dx, dy) {
    var x = ctx.x;
    var y = ctx.y;
    x1 = coalesce(x1, x);
    y1 = coalesce(y1, y);
    x2 = coalesce(x2, x);
    y2 = coalesce(y2, y);
    dx = coalesce(dx, x);
    dy = coalesce(dy, y);
    ctx.p.push(x1, y1, x2, y2, dx, dy);
    ctx.x = dx;
    ctx.y = dy;
    ctx.lc = ctx.c;
}
function convertToAbsolute(ctx) {
    if (ctx.c === V) {
        ctx.t[0] += ctx.y;
    }
    else if (ctx.c === H) {
        ctx.t[0] += ctx.x;
    }
    else {
        for (var j = 0; j < ctx.t.length; j += 2) {
            ctx.t[j] += ctx.x;
            ctx.t[j + 1] += ctx.y;
        }
    }
}
function parseSegments(d) {
    return d
        .replace(/[\^\s]?([mhvlzcsqta]|\-?\d*\.?\d+)[,\$\s]?/gi, ' $1')
        .replace(/([mhvlzcsqta])/gi, ' $1')
        .trim()
        .split('  ')
        .map(parseSegment);
}
function parseSegment(s2) {
    return s2.split(' ').map(parseCommand);
}
function parseCommand(str, i) {
    return i === 0 ? str : +str;
}
function parsePoints(d) {
    var ctx = {
        x: 0,
        y: 0,
        lc: _,
        c: _,
        cx: _,
        cy: _,
        t: _,
        s: [],
        p: _
    };
    var segments = parseSegments(d);
    for (var i = 0; i < segments.length; i++) {
        var terms = segments[i];
        var commandLetter = terms[0];
        var command = commandLetter.toUpperCase();
        var isRelative = command !== Z && command !== commandLetter;
        ctx.c = command;
        var parser = parsers[command];
        var maxLength = argLengths[command];
        if (!parser) {
            raiseError(ctx.c, ' is not supported');
        }
        var t2 = terms;
        var k = 1;
        do {
            ctx.t = t2.slice(k, k + maxLength);
            if (isRelative) {
                convertToAbsolute(ctx);
            }
            parser(ctx);
            k += maxLength;
        } while (k < t2.length);
    }
    return ctx.s;
}

function createPathSegmentArray(points) {
    var xmin, xmax, ymin, ymax;
    xmin = xmax = points[0];
    ymin = ymax = points[1];
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
        h: ymax - ymin
    };
}
function parsePath(d) {
    return {
        path: d,
        data: parsePoints(d).map(createPathSegmentArray)
    };
}

function parse(d) {
    return parsePath(getPath(d));
}

function morph(paths) {
    return morphPath(paths.map(parse));
}

function toBezier(d) {
    return renderPath(parsePoints(getPath(d)));
}

function reversePath(s) {
    var d = s.slice(-2);
    for (var i = s.length - 3; i > -1; i -= 6) {
        d.push(s[i - 1], s[i], s[i - 3], s[i - 2], s[i - 5], s[i - 4]);
    }
    return d;
}

function reverse(path) {
    return renderPath(parsePoints(getPath(path))
        .map(reversePath)
        .reverse());
}

exports.getPath = getPath;
exports.morph = morph;
exports.parse = parse;
exports.toBezier = toBezier;
exports.reverse = reverse;

return exports;

}({}));
