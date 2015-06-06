var hurdles = require('../src/hurdles');
var _ = require('lodash');

describe('hurdles', function () {
  var output;
  var asyncError;

  var foo = {a: 1, b: 2};
  var bar = {x: 3, y: 4};

  beforeEach(function () {
    output = null;
    asyncError = null;
    hurdles.registerHandler('foo', function () {
      return Promise.resolve(foo);
    });
    hurdles.registerHandler('bar', function () {
      return Promise.resolve(bar);
    });
  });


  function runQuery(q, done) {
    hurdles.query(q).then(function (o) {
      output = o;
      done()
    }).catch(function (e) {
      asyncError = e;
      done();
    });
  };

  describe('happy day query', function () {
    beforeEach(function (done) {
      runQuery({foo: {a: null, b: null}}, done);
    });
    it("all nulls replaced with value", function () {
      if (asyncError) throw asyncError;
      expect(output).toEqual({foo: foo});
    });
  });

  describe('query for some fields', function () {
    beforeEach(function (done) {
      runQuery({foo: {a: null}}, done);
    });
    it("selects only some fields", function () {
      if (asyncError) throw asyncError;
      expect(output).toEqual({foo: {a: foo.a}});
    });
  });

  describe('nested query', function () {
    beforeEach(function (done) {
      runQuery({
        foo: {
          a: null,
          b: null,
          bar: {
            x: null,
            y: null
          }
        }
      }, done);
    });

    it("selects nested object", function () {
      if (asyncError) throw asyncError;
      var expected = {
        foo: {
          a: foo.a,
          b: foo.b,
          bar: {
            x: bar.x,
            y: bar.y
          }
        }
      };
      expect(output).toEqual(expected);
    });
  });
});