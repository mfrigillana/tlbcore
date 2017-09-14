/*

  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
*/
/* globals _ */

exports.drawTooltip = drawTooltip;
exports.goodGraphColor = goodGraphColor;
exports.mkShinyPattern = mkShinyPattern;
exports.drawRountangle = drawRountangle;
exports.drawSpinner = drawSpinner;
exports.blendColors = blendColors;

function drawTooltip(ctx, lo, x, y, str) {
  ctx.tooltipLayer(function() {
    let lines = str.split('\n');
    ctx.font = lo.tooltipFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let lineH = lo.tooltipSize * 1.6;
    let textW = _.reduce(lines, function(prevMax, line) { return Math.max(prevMax, ctx.measureText(line).width); }, 20);
    let textH = lineH * lines.length;

    if (y < lo.boxT + textH + 10) { // close to top, show below
      y += textH/2 + 10;
    } else {
      y -= textH/2 + 10;
    }
    y = Math.min(y, lo.boxB-textH/2-5);
    y = Math.max(y, lo.boxT+textH/2+5);

    x = Math.min(x, lo.boxR - 10 - textW);
    x = Math.max(x, lo.boxL + 10);

    let ttL = x - 6 - lo.tooltipPadding;
    let ttR = x + 6 + textW + lo.tooltipPadding;
    let ttT = y - textH/2 + lo.tooltipPadding;
    let ttB = y + textH/2 + 2 + lo.tooltipPadding;
    ctx.beginPath();
    ctx.moveTo(ttL, ttT);
    ctx.lineTo(ttR, ttT);
    ctx.lineTo(ttR, ttB);
    ctx.lineTo(ttL, ttB);
    ctx.closePath();
    ctx.fillStyle = lo.tooltipFillStyle;
    ctx.fill();
    ctx.fillStyle = lo.tooltipTextStyle;
    _.each(lines, function(line, lineIndex) {
      ctx.fillText(line, x, ttT + lineH * (lineIndex+0.5));
    });
  });
}

function mkShinyPattern(ctx, butT, butR, butB, butL, loCol, hiCol) {
  let cX = (butL + butR)/2;
  let skew = 0;
  let pat = ctx.createLinearGradient(cX-skew, butT, cX+skew, butB); // vertical
  pat.addColorStop(0.125, '#e5e5e5');
  pat.addColorStop(0.250, loCol);
  pat.addColorStop(0.375, hiCol);
  pat.addColorStop(0.875, '#e5e5e5');
  pat.addColorStop(1.000, '#e5e5e5');
  return pat;
}

function drawRountangle(ctx, t, r, b, l, rad) {
  ctx.moveTo(l+rad, t);
  ctx.lineTo(r-rad, t);
  ctx.arc(r-rad, t+rad, rad, -Math.PI/2, 0);
  ctx.lineTo(r, b-rad);
  ctx.arc(r-rad, b-rad, rad, 0, Math.PI/2);
  ctx.lineTo(l+rad, b);
  ctx.arc(l+rad, b-rad, rad, Math.PI/2, Math.PI);
  ctx.lineTo(l, t+rad);
  ctx.arc(l+rad, t+rad, rad, Math.PI, Math.PI*3/2);
}

function drawSpinner(ctx, spinnerX, spinnerY, spinnerSize, phase) {

  let dotSize = 0.15 * spinnerSize;

  for (let i=0; i<12; i++) {
    let theta = i * (Math.PI / 6.0);
    let dirX = Math.cos(theta) * spinnerSize/30;
    let dirY = Math.sin(theta) * spinnerSize/30;

    let dimness = ((phase - theta + 4*Math.PI) % (2*Math.PI)) / (2*Math.PI);

    ctx.beginPath();
    ctx.arc(spinnerX + 30.5*dirX,  spinnerY + 30.5*dirY, dotSize, 0, 2*Math.PI);
    ctx.fillStyle = 'rgba(180, 180, 180, ' + (0.875 - 0.750 * dimness).toString() + ')';
    ctx.fill();
  }
}


/*
  For maximum convenience, import these with
  let I = Geom2D.I, T = Geom2D.T, R = Geom2D.R, R0 = Geom2D.R0, S = Geom2D.S, S1 = Geom2D.S1, D = Geom2D.D, A = Geom2D.A;
*/

let Geom2D = {
  I: function() { // identity matrix
    return [[1, 0, 0],
            [0, 1, 0]];
  },
  T: function T(t, x, y) { // Transform a local coordinate
    return [[t[0][0], t[0][1], t[0][0]*x + t[0][1]*y + t[0][2]],
            [t[1][0], t[1][1], t[1][0]*x + t[1][1]*y + t[1][2]]];
  },
  R: function R(t, a) { // Rotate
    let ca = Math.cos(a), sa = Math.sin(a);
    return [[t[0][0]*ca - t[1][0]*sa, t[0][1]*ca + t[1][1]*sa, t[0][2]],
            [t[1][0]*ca + t[0][0]*sa, t[1][1]*ca + t[1][0]*sa, t[1][2]]];
  },
  R0: function R0(t) { // Rotate to zero
    let s = Math.sqrt(t[0][0]*t[0][0] + t[0][1]*t[0][1]);
    return [[s, 0, t[0][2]],
            [0, s, t[1][2]]];
  },
  S: function S(t, s) { // Scale
    return [[t[0][0]*s,   t[0][1]*s, t[0][2]],
            [t[1][0]*s,   t[1][1]*s, t[1][2]]];
  },
  S1: function S1(t) { // Scales to 1
    let a = Math.atan2(t[1][0], t[0][0]);
    let ca = Math.cos(a), sa = Math.sin(a);
    return [[ca, -sa, t[0][2]],
            [sa, ca, t[1][2]]];
  },
  D: function D(a, b) {
    return Math.sqrt((a[0][2]-b[0][2])*(a[0][2]-b[0][2]) + (a[1][2]-b[1][2])*(a[1][2]-b[1][2]));
  },
  A: function A(a, b) {
    return Math.atan2(b[1][2] - a[1][2], b[0][2] - a[0][2]);
  }
};
exports.Geom2D = Geom2D;

/*
  These use a 3x4 matrix stored in column-major order, so the elements are
    0  3  6  9
    1  4  7  10
    2  5  8  11
  For maximum convenience, import these with
  let I = Geom3D.I, T = Geom3D.T, S = Geom3D.S
*/

let Geom3D = {
  I: function() { // identity matrix
    return Float64Array.of(
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      0, 0, 0);
  },
  T: function T(t, x, y, z) { // Transform a local coordinate
    return Float64Array.of(
      t[0], t[1], t[2],
      t[3], t[4], t[5],
      t[6], t[7], t[8],
      t[9] + t[0]*x + t[3]*y + t[6]*z,
      t[10] + t[1]*x + t[4]*y + t[7]*z,
      t[11] + t[2]*x + t[5]*y + t[8]*z);
  },
  S: function S(t, s) { // Scale
    return Float64Array.of(
      t[0]*s,   t[1]*s, t[2]*s,
      t[3]*s,   t[4]*s, t[5]*s,
      t[6]*s,   t[7]*s, t[8]*s,
      t[9], t[10], t[11]);

  },
  fromOrientation: function(m) {
    return Float64Array.of(
      m[0], m[1], m[2],
      m[3], m[4], m[5],
      m[6], m[7], m[8],
      0, 0, 0);
  },
  fromOrientation44: function(m) {
    return Float64Array.of(
      m[0], m[1], m[2],
      m[4], m[5], m[6],
      m[8], m[9], m[10],
      m[12], m[13], m[14]);
  },
  toScreen: function(t, xc, yc, zc) {
    let persp = zc/(zc + t[10]);
    // X is right, Y is away from viewer, Z is up
    return Float64Array.of(
      xc + t[9]*persp,
      yc - t[11]*persp,
      zc + t[10]);
  },
  depthSort: function(faces) {
    return _.sortBy(faces, function(face) {
      // Sort by the average z coordinate of all the coords of the face
      let coords = face.coords;
      let cl = coords.length;
      if (cl === 0) return 0.0;
      let accum = 0.0;
      for (let i=0; i<cl; i++) {
        accum += coords[i][2];
      }
      return -accum / cl;
    });
  },
  toHomo_mat33_mat44: function(m) {
    return Float64Array.of(
      m[0], m[1], m[2], 0,
      m[3], m[4], m[5], 0,
      m[6], m[7], m[8], 0,
      0, 0, 0, 1
    );
  },
  identity_mat33: Float64Array.of(
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ),
  identity_mat44: Float64Array.of(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ),
  mul_mat44_mat44: function(a, b) {
    return Float64Array.of(
      a[0]*b[0] + a[4]*b[1] + a[8]*b[2] + a[12]*b[3],
      a[1]*b[0] + a[5]*b[1] + a[9]*b[2] + a[13]*b[3],
      a[2]*b[0] + a[6]*b[1] + a[10]*b[2] + a[14]*b[3],
      a[3]*b[0] + a[7]*b[1] + a[11]*b[2] + a[15]*b[3],

      a[0]*b[4] + a[4]*b[5] + a[8]*b[6] + a[12]*b[7],
      a[1]*b[4] + a[5]*b[5] + a[9]*b[6] + a[13]*b[7],
      a[2]*b[4] + a[6]*b[5] + a[10]*b[6] + a[14]*b[7],
      a[3]*b[4] + a[7]*b[5] + a[11]*b[6] + a[15]*b[7],

      a[0]*b[8] + a[4]*b[9] + a[8]*b[10] + a[12]*b[11],
      a[1]*b[8] + a[5]*b[9] + a[9]*b[10] + a[13]*b[11],
      a[2]*b[8] + a[6]*b[9] + a[10]*b[10] + a[14]*b[11],
      a[3]*b[8] + a[7]*b[9] + a[11]*b[10] + a[15]*b[11],

      a[0]*b[12] + a[4]*b[13] + a[8]*b[14] + a[12]*b[15],
      a[1]*b[12] + a[5]*b[13] + a[9]*b[14] + a[13]*b[15],
      a[2]*b[12] + a[6]*b[13] + a[10]*b[14] + a[14]*b[15],
      a[3]*b[12] + a[7]*b[13] + a[11]*b[14] + a[15]*b[15]
    );
  },
  mul_mat44_vec4: function(a, b) {
    return Float64Array.of(
      a[0]*b[0] + a[4]*b[1] + a[8]*b[2] + a[12]*b[3],
      a[1]*b[0] + a[5]*b[1] + a[9]*b[2] + a[13]*b[3],
      a[2]*b[0] + a[6]*b[1] + a[10]*b[2] + a[14]*b[3],
      a[3]*b[0] + a[7]*b[1] + a[11]*b[2] + a[15]*b[3]
    );
  },
  add_mat44_mat44: function(a, b) {
    return Float64Array.of(
      a[0] + b[0],
      a[1] + b[1],
      a[2] + b[2],
      a[3] + b[3],

      a[4] + b[4],
      a[5] + b[5],
      a[6] + b[6],
      a[7] + b[7],

      a[8] + b[8],
      a[9] + b[9],
      a[10] + b[10],
      a[11] + b[11],

      a[12] + b[12],
      a[13] + b[13],
      a[14] + b[14],
      a[15] + b[15]
    );
  }

};
exports.Geom3D = Geom3D;

/*
  Return c0 + (c1-c0)*p, with c0,c1 in RGB color space
  Requires '#RRGGBB' format
*/
function blendColors(c0, c1, p) {
    let c0h = parseInt(c0.slice(1), 16);
    let c1h = parseInt(c1.slice(1), 16);
    let r0 = (c0h>>16) & 0xff;
    let g0 = (c0h>>8) & 0xff;
    let b0 = (c0h>>0) & 0xff;
    let r1 = (c1h>>16) & 0xff;
    let g1 = (c1h>>8) & 0xff;
    let b1 = (c1h>>0) & 0xff;
    return "#" + (0x1000000+
      (Math.round((r1 - r0)*p) + r0) * 0x10000 +
      (Math.round((g1 - g0)*p) + g0) * 0x100 +
      (Math.round((b1 - b0)*p) + b0)).toString(16).slice(1);
}


let _goodGraphColors = [
  '#F15854', // red
  '#5DA5DA', // blue
  '#FAA43A', // orange
  '#60BD68', // green
  '#F17CB0', // pink
  '#B2912F', // brown
  '#B276B2', // purple
  '#DECF3F', // yellow
  '#4D4D4D', // gray
  // Munin:
  '#00cc00',
  '#0066b3',
  '#ff8000',
  '#ffcc00',
  '#330099',
  '#990099',
  '#ccff00',
  '#ff0000',
  '#808080',
  '#008f00',
  '#00487d',
  '#b35a00',
  '#b38f00',
  '#6b006b',
  '#8fb300',
  '#b30000',
  '#bebebe',
  '#80ff80',
  '#80c9ff',
  '#ffc080',
  '#ffe680',
  '#aa80ff',
  '#ee00cc',
  '#ff8080',
  '#666600',
  '#ffbfff',
  '#00ffcc',
  '#cc6699',
  '#999900'
];

let _darkGraphColors = _.map(_goodGraphColors, function(c) { blendColors(c, '#000000', 0.33); });

function goodGraphColor(i) {
  return _goodGraphColors[i % _goodGraphColors.length];
}
function darkGraphColor(i) {
  return _darkGraphColors[i % _darkGraphColors.length];
}
