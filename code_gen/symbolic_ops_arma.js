/*
*/
'use strict';
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const defop = symbolic_math.defop;


// mat33

defop('Mat33',    'mat33RotationZ',   'double', {
  imm: function(a) {
    let ca = Math.cos(a);
    let sa = Math.sin(a);
    return [
      +ca, +sa, 0,
      -sa, ca, 0,
      0, 0, 1];
  },
  c: function(a) {
    return `Mat33 { cos(${a}), sin(${a}), 0, -sin(${a}), cos(${a}), 0, 0, 0, 1 }`;
  },
  js: function(a) {
    return `Float64Array.of( cos(${a}), sin(${a}), 0, -sin(${a}), cos(${a}), 0, 0, 0, 1 )`;
  },
});


// mat44

defop('Mat44',        'mat44RotationX',   'double', {
  optimize: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
  },
  expand: function(c, a) {
    return c.E('Mat44',
      c.Cd(1), c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), c.E('cos', a), c.E('sin', a), c.Cd(0),
      c.Cd(0), c.E('-', c.E('sin', a)), c.E('cos', a), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('Mat44',        'mat44RotationY',   'double', {
  optimize: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
  },
  expand: function(c, a) {
    return c.E('Mat44',
      c.E('cos', a), c.Cd(0), c.E('-', c.E('sin', a)), c.Cd(0),
      c.Cd(0), c.Cd(1), c.Cd(0), c.Cd(0),
      c.E('sin', a), c.Cd(0), c.E('cos', a), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('Mat44',        'mat44RotationZ',   'double', {
  optimize: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
  },
  expand: function(c, a) {
    return c.E('Mat44',
      c.E('cos', a), c.E('sin', a), c.Cd(0), c.Cd(0),
      c.E('-', c.E('sin', a)), c.E('cos', a), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(1), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('Mat44',        'mat44Translation',   'double', 'double', 'double', {
  optimize: function(c, x, y, z) {
    if (x.isZero() && y.isZero() && z.isZero()) {
      return c.Cm44(1);
    }
  },
  expand: function(c, x, y, z) {
    return c.E('Mat44',
      c.Cd(1), c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(1), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(1), c.Cd(0),
      x, y, z, c.Cd(1));
  }
});

defop('Mat44',        'mat44Scale',   'double', 'double', 'double', {
  optimize: function(c, x, y, z) {
    if (x.isZero() && y.isZero() && z.isZero()) {
      return c.Cm44(0);
    }
  },
  expand: function(c, x, y, z) {
    return c.E('Mat44',
      x, c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), y, c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), z, c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('Mat44',        'mat44Rotation',   'Vec3', 'double', {
  optimize: function(c, a, b) {
    if (b.isZero()) {
      return c.Cm44(1);
    }
  },
  js: function(a, b) {
    return `Geom3D.mat44Rotation(${a}, ${b})`;
  },
  c: function(a, b) {
    return `mat44Rotation(${a}, ${b})`;
  },
});


_.each([0,1,2,3], function(rowi) {
  _.each([0,1,2,3], function(coli) {
    defop('R',    `(${rowi},${coli})`,           'Mat44', {
      c: function(a) {
        return `(${a}(${rowi},${coli}))`;
      },
      js: function(a) {
        return `(${a}[${rowi} + 4*${coli}])`;
      },
      deriv: function(c, wrt, a) {
        return c.E(`(${rowi},${coli})`, c.D(wrt, a));
      },
      gradient: function(c, deps, g, a) {
        a.addGradient(deps, c.E('*', g, c.C('Mat44', _.map(_.range(16), (i) => (i == coli*4 + rowi) ? 1 : 0))));
      },
    });
  });
});

_.each([0,1,2,3], function(i) {
  defop('R',    `(${i})`,           'Vec4', {
    c: function(a) {
      return `(${a}(${i}))`;
    },
    js: function(a) {
      return `(${a}[${i}])`;
    },
    deriv: function(c, wrt, a) {
      return c.E(`(${i})`, c.D(wrt, a));
    },
    gradient: function(c, deps, g, a) {
      a.addGradient(deps, c.E('*', g, c.C('Vec4', _.map(_.range(4), (i2) => (i2 == i) ? 1 : 0))));
    },
  });
});

_.each([0,1,2], function(i) {
  defop('R',    `(${i})`,           'Vec3', {
    c: function(a) {
      return `(${a}(${i}))`;
    },
    js: function(a) {
      return `(${a}[${i}])`;
    },
    deriv: function(c, wrt, a) {
      return c.E(`(${i})`, c.D(wrt, a));
    },
    gradient: function(c, deps, g, a) {
      a.addGradient(deps, c.E('*', g, c.C('Vec3', _.map(_.range(3), (i2) => (i2 == i) ? 1 : 0))));
    },
  });
});


defop('Mat44',    'trans',           'Mat44', {
  c: function(a) {
    return `trans(${a})`;
  },
  js: function(a) {
    return `Geom3D.trans_mat44(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('trans', c.D(wrt, a));
  },
});


defop('Mat44',    '*',           'Mat44', 'Mat44', {
  c: function(a, b) {
    return `(${a} * ${ b })`;
  },
  js: function(a, b) {
    return `Geom3D.mul_mat44_mat44(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', c.E('trans', b), g)); // FIXME: test
    b.addGradient(deps, c.E('*', c.E('trans', a), g)); // FIXME: test
  },
});

defop('Mat44',    '*',           'R', 'Mat44', {
  c: function(a, b) {
    return `(${a} * ${ b })`;
  },
  js: function(a, b) {
    return `Geom3D.mul_double_mat44(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  optimize: function(c, a, b) {
    if (b.isZero()) return b;
    if (a.isOne()) return b;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', b, g));
    b.addGradient(deps, c.E('*', c.E('trans', a), g)); // FIXME: test
  },
});

defop('Vec4',    '*',           'R', 'Vec4', {
  c: function(a, b) {
    return `(${a} * ${ b })`;
  },
  js: function(a, b) {
    return `Geom3D.mul_double_vec4(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  optimize: function(c, a, b) {
    if (b.isZero()) return b;
    if (a.isOne()) return b;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', b, g));
    b.addGradient(deps, c.E('*', a, g));
  },
});


defop('Vec4',    '*',           'Mat44', 'Vec4', {
  c: function(a, b) {
    return `(${a} * ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.mul_mat44_vec4(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  optimize: function(c, a, b) {
    if (b.isZero()) return b;
    if (a.isOne()) return b;
  },
  gradient: function(c, deps, g, a, b) {
    // FIXME a.addGradient(c.E('kron', g, b));
    b.addGradient(deps, c.E('*', c.E('trans', a), g));
  },
});

defop('Mat44',    '+',           'Mat44', 'Mat44', {
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.add_mat44_mat44(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.D(wrt, a),
      c.D(wrt, b));
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, g);
  },
});

defop('Vec4',    '+',           'Vec4', 'Vec4', {
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.add_vec4_vec4(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.D(wrt, a),
      c.D(wrt, b));
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, g);
  },
});

defop('Vec3',    '+',           'Vec3', 'Vec3', {
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.add_vec3_vec3(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.D(wrt, a),
      c.D(wrt, b));
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, g);
  },
});


defop('Vec3',    'fromHomo',           'Vec4', {
  replace: function(c, a) {
    return c.E('Vec3',
      c.E('/', c.E('(0)', a), c.E('(3)', a)),
      c.E('/', c.E('(1)', a), c.E('(3)', a)),
      c.E('/', c.E('(2)', a), c.E('(3)', a)));
  }
});



if (0) { // WRITEME someday
  defop('double',        'at',          'Mat22', 'int', 'int');
  defop('double',        'at',          'Mat33', 'int', 'int');
  defop('double',        'at',          'Mat44', 'int', 'int');

  defop('double',        'at',          'Vec2', 'int');
  defop('double',        'at',          'Vec3', 'int');
  defop('double',        'at',          'Vec4', 'int');

  defop('Mat22',    '*',          'Mat22', 'Mat22');
  defop('Mat33',    '*',          'Mat33', 'Mat33');

  defop('Mat22',    '+',          'Mat22', 'Mat22');
  defop('Mat33',    '+',          'Mat33', 'Mat33');
  defop('Mat44',   '+',           'Mat44', 'Mat44');

  defop('Mat22',    '-',          'Mat22', 'Mat22');
  defop('Mat33',    '-',          'Mat33', 'Mat33');
  defop('Mat44',   '-',           'Mat44', 'Mat44');

  defop('Vec2',    '*',           'Vec2', 'Vec2');
  defop('Vec3',    '*',           'Vec3', 'Vec3');
  defop('Vec4',    '*',           'Vec4', 'Vec4');

  defop('Vec2',    '+',           'Vec2', 'Vec2');
  defop('Vec3',    '+',           'Vec3', 'Vec3');
  defop('Vec4',    '+',           'Vec4', 'Vec4');

  defop('Vec2',    '-',           'Vec2', 'Vec2');
  defop('Vec3',    '-',           'Vec3', 'Vec3');
  defop('Vec4',    '-',           'Vec4', 'Vec4');

  defop('Mat33',   'inverse',     'Mat33');
  defop('Mat44',   'inverse',     'Mat44');
  defop('Mat33',   'transpose',   'Mat33');

  defop('Mat22',   '*',           'Mat22', 'double');
  defop('Mat33',   '*',           'Mat33', 'double');
  defop('Mat44',   '*',           'Mat44', 'double');

  defop('Vec2',    '*',           'Mat22', 'Vec2');
  defop('Vec3',    '*',           'Mat33', 'Vec3');
  defop('Vec3',    '*',           'Mat44', 'Vec3');
  defop('Vec4',    '*',           'Mat44', 'Vec4');

  defop('Vec2',    '*',           'Vec2', 'double');
  defop('Vec3',    '*',           'Vec3', 'double');
  defop('Vec4',    '*',           'Vec4', 'double');

  defop('Vec2',    '*',           'double', 'Vec2');
  defop('Vec3',    '*',           'double', 'Vec3');
  defop('Vec4',    '*',           'double', 'Vec4');

  defop('Vec3',    'cross',       'Vec3', 'Vec3');
  defop('float',         'dot',         'Vec3', 'Vec3');

}
