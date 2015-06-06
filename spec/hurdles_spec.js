var hurdlesFactory = require('../src/hurdles');
var _ = require('lodash');

describe('hurdles', function () {
  var output;
  var asyncError;
  var foo = {a: 1, b: 2};
  var bar = {x: 3, y: 4};

  function handlers(typeToObjectMap) {
    var handlers = {};
    _.each(typeToObjectMap, function (v, k) {
      handlers[k] = function () {
        return Promise.resolve(v);
      };
    });
    return handlers;
  };

  beforeEach(function () {
    output = null;
    asyncError = null;
  });


  function runQuery(hurdles, q, done) {
    hurdles.query(q).then(function (o) {
      output = o;
      done()
    }).catch(function (e) {
      asyncError = e;
      done();
    });
  };

  describe('querying with simple object', function () {
    beforeEach(function (done) {
      var hurdles = hurdlesFactory(handlers({foo: foo}));
      var query = {foo: {a: null, b: null}};
      runQuery(hurdles, query, done);
    });
    it("has same shape and filled values", function () {
      if (asyncError) throw asyncError;
      expect(output).toEqual({foo: {a: foo.a, b: foo.b}});
    });
  });

  describe('query with no matching handler', function () {
    beforeEach(function (done) {
      var hurdles = hurdlesFactory(handlers({}));
      var query = {foo: {a: null, b: null}};

      runQuery(hurdles, query, done);
    });

    it("throws error", function () {
      expect(asyncError.message).toMatch(/unhandled type/);
    });
  });

  describe('query for some fields', function () {
    beforeEach(function (done) {
      var hurdles = hurdlesFactory(handlers({foo: foo}));
      runQuery(hurdles, {foo: {a: null}}, done);
    });
    it("selects only some fields", function () {
      if (asyncError) throw asyncError;
      expect(output).toEqual({foo: {a: foo.a}});
    });
  });

  describe('query for nested shape filled by one handler', function () {
    var expected = {
      foo: {
        a: foo.a,
        b: foo.b,
        bar: {
          x: bar.x,
          y: bar.y
        }
      }
    }
    beforeEach(function (done) {
      var hurdles = hurdlesFactory(handlers({
        foo: expected.foo
      }));
      runQuery(hurdles, {
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

    it("fills nested shape using one handler", function () {
      if (asyncError) throw asyncError;
      expect(output).toEqual(expected);
    });
  });

  describe('query with nested shape that root handler does not fill', function () {
    beforeEach(function (done) {
      var hurdles = hurdlesFactory(handlers({foo: foo, bar: bar}));
      runQuery(hurdles, {
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

    it("fills nested shape using handler", function () {
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