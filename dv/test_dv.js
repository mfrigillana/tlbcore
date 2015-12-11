var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('dv should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
  });


  it('should work with ops', function() {
    var a = new ur.Dv(1.5);
    var b = new ur.Dv(2.5);
    var c = ur.mul(a, b);
    assert.equal(c.deriv, 0);

    a.deriv = 1;
    assert.equal(a.deriv, 1);
    var cWrtA = ur.mul(a, b);
    assert.equal(cWrtA.deriv, 2.5);
    a.deriv = 0;

    b.deriv = 1;
    assert.equal(b.deriv, 1);
    var cWrtB = ur.mul(a, b);
    b.deriv = 0;
    assert.equal(cWrtB.deriv, 1.5)
    
  });

  it('should find Dvs', function() {
    var a = new ur.DvPolyfit5();
    a.foreachDv(function(dv) {
      dv.deriv = 1;
      var ans = ur.getValue(a, 0.5);
      console.log(dv, ans);
      dv.deriv = 0;
    });
  });
});
