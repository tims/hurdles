var hurdlesFactory = require('../src/hurdles2');
var _ = require('lodash');

describe('hurdles', function () {
  var output;
  var asyncError;

  beforeEach(function () {
    output = null;
    asyncError = null;
  });

  function runQuery(hurdles, q, done) {
    hurdles.run(q).then(function (o) {
      output = o;
      done()
    }).catch(function (e) {
      asyncError = e;
      console.error(e.stack);
      done();
    });
  };

  describe('findQueries', function () {
    it('finds most basic possible task', function () {
      var hurdles = hurdlesFactory({});

      var queryDef = {
        'foo()': null
      };
      var tasks = hurdles._findQueries(queryDef, ['root']);
      expect([{
        name: 'foo',
        queryKey: 'foo()',
        queryParams: Object({}),
        path: ['root', 'foo()'],
        shape: null
      }]).toEqual(tasks);
    });

    it('splits query into two tasks', function () {
      var hurdles = hurdlesFactory({});

      var queryDef = {
        'foo()': {
          'bar()': null
        }
      };
      var tasks = hurdles._findQueries(queryDef, ['root']);
      expect([{
        name: 'foo',
        queryKey: 'foo()',
        queryParams: Object({}),
        path: ['root', 'foo()'],
        shape: {bar: null}
      }, {
        name: 'bar',
        queryKey: 'bar()',
        queryParams: Object({}),
        path: ['root', 'foo()', 'bar()'],
        shape: null
      }]).toEqual(tasks);
    });

    it('finds two tasks at same depth', function () {
      var hurdles = hurdlesFactory({});
      var queryDef = {
        'foo()': null,
        'bar()': null
      };
      var tasks = hurdles._findQueries(queryDef, ['root']);
      expect([{
        name: 'foo',
        queryKey: 'foo()',
        queryParams: Object({}),
        path: ['root', 'foo()'],
        shape: null
      }, {
        name: 'bar',
        queryKey: 'bar()',
        queryParams: Object({}),
        path: ['root', 'bar()'],
        shape: null
      }]).toEqual(tasks);
    });
  });

  describe('run', function () {
    var hurdles;
    beforeEach(function () {
      hurdles = hurdlesFactory({
        hello: function () {
          return Promise.resolve('hello world');
        },
        foo: function () {
          return Promise.resolve({a: 1});
        },
        bar: function () {
          return Promise.resolve({b: 2});
        },
        recordsInput: function (query, input) {
          return Promise.resolve({input: input});
        },
        array: function () {
          return Promise.resolve([1, 2, 3]);
        },
        arrayOfObjects: function () {
          return Promise.resolve([{x: 1}, {x: 2}, {x: 3}]);
        },
        user: function () {
          return Promise.resolve({id:1, name:'Tim'});
        }
      });
    });

    it('uses handler', function (done) {
      var queryDef = {
        'hello()': null
      };
      hurdles.run(queryDef).then(function (output) {
        expect({hello: 'hello world'}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('calls two handlers', function (done) {
      var queryDef = {
        'foo()': {a: null},
        'bar()': {b: null}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          'foo': {a: 1},
          'bar': {b: 2}
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('nested queries call handlers', function (done) {
      var queryDef = {
        'foo()': {
          a: null,
          'bar()': {b: null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          'foo': {
            a: 1,
            bar: {
              b: 2
            }
          }
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('child receives input from parent', function (done) {
      var queryDef = {
        'foo()': {
          a: null,
          'recordsInput()': {input: null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({root: {}, foo: {a: 1}}).toEqual(output.foo.recordsInput.input);
      }).catch(fail).then(done);
    });

    it('handler can return array', function (done) {
      var queryDef = {
        'array()': null
      };
      hurdles.run(queryDef).then(function (output) {
        expect({array: [1, 2, 3]}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('children get applied to each element of parent\'s output array', function (done) {
      var queryDef = {
        'arrayOfObjects()': {
          'foo()': {a: null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {x: 1, foo: {a: 1}},
            {x: 2, foo: {a: 1}},
            {x: 3, foo: {a: 1}}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('children get input from each element of parent\'s output array', function (done) {
      var queryDef = {
        'arrayOfObjects()': {
          'recordsInput()': {input:null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {x: 1, recordsInput: {input: {arrayOfObjects: {x:1}, root: {}}}},
            {x: 2, recordsInput: {input: {arrayOfObjects: {x:2}, root: {}}}},
            {x: 3, recordsInput: {input: {arrayOfObjects: {x:3}, root: {}}}}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('can define constants', function (done) {
      var queryDef = {
        'bla': 1
      };
      hurdles.run(queryDef).then(function (output) {
        expect({bla:1}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('can define constants within a query', function (done) {
      var queryDef = {
        'foo()': {
          a:null,
          x:1
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a:1,x:1}}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('limits the fields to the requested shape', function (done) {
      var queryDef = {
        'user()': {
          name: null
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({user: {name:'Tim'}}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('fails if requesting more fields in the shape than are available', function (done) {
      var queryDef = {
        'user()': {
          id: null,
          name: null,
          dob: null
        }
      };
      hurdles.run(queryDef).then(function (output) {
        fail('expected rejection because dateOfBirth isn\'t available');
      }).catch().then(done);
    });

    it('should override shape constants with output', function (done) {
      var queryDef = {
        'foo()': {
          a: 5
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a:1}}).toEqual(output);
      }).catch(fail).then(done);
    });
  });


  //
  //describe('querying with simple object', function () {
  //  beforeEach(function (done) {
  //    var hurdles = hurdlesFactory({
  //      foo: function(query, input) {
  //        return Promise.reject('help');
  //      }
  //    });
  //    var query = {'foo()': {a: null, b: null}};
  //    runQuery(hurdles, query, done);
  //  });
  //  it("has same shape and filled values", function () {
  //    if (asyncError) throw asyncError;
  //    expect(output).toEqual({foo: {a: foo.a, b: foo.b}});
  //  });
  //});
  //
  //describe('query with no matching handler', function () {
  //  beforeEach(function (done) {
  //    var hurdles = hurdlesFactory({});
  //    var query = {foo: {a: null, b: null}};
  //
  //    runQuery(hurdles, query, done);
  //  });
  //
  //  it("throws error", function () {
  //    expect(asyncError.message).toMatch(/unhandled type/);
  //  });
  //});
  //
  //describe('query for some fields', function () {
  //  beforeEach(function (done) {
  //    var handlers = new Handlers().add('foo', 'read', foo);
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {foo: {a: null}}, done);
  //  });
  //  it("selects only some fields", function () {
  //    if (asyncError) throw asyncError;
  //    expect(output).toEqual({foo: {a: foo.a}});
  //  });
  //});
  //
  //describe('query for nested shape filled by one handler', function () {
  //  var expected = {
  //    foo: {
  //      a: foo.a,
  //      b: foo.b,
  //      bar: {
  //        x: bar.x,
  //        y: bar.y
  //      }
  //    }
  //  }
  //  beforeEach(function (done) {
  //    var handlers = new Handlers().add('foo', 'read', expected.foo);
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      foo: {
  //        a: null,
  //        b: null,
  //        bar: {
  //          x: null,
  //          y: null
  //        }
  //      }
  //    }, done);
  //  });
  //
  //  it("fills nested shape using one handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(output).toEqual(expected);
  //  });
  //});
  //
  //describe('multiple handlers and query with nested shape', function () {
  //  var handlers;
  //  beforeEach(function (done) {
  //    handlers = new Handlers()
  //      .add('foo', 'read', foo)
  //      .add('bar', 'read', bar);
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      foo: {
  //        a: null,
  //        b: null,
  //        bar: {
  //          x: null,
  //          y: null
  //        }
  //      }
  //    }, done);
  //  });
  //
  //  it("fills nested shape using second handler", function () {
  //    if (asyncError) throw asyncError;
  //    var expected = {
  //      foo: {
  //        a: foo.a,
  //        b: foo.b,
  //        bar: {
  //          x: bar.x,
  //          y: bar.y
  //        }
  //      }
  //    };
  //    expect(output).toEqual(expected);
  //  });
  //
  //  it("second handler receives first handler's output as input", function () {
  //    if (asyncError) throw asyncError;
  //    expect(handlers.inputs.bar.read).toEqual({foo: foo});
  //  });
  //});
  //
  //describe('deeply nested query', function () {
  //  var handlers;
  //  beforeEach(function (done) {
  //    handlers = new Handlers()
  //      .add('top', 'read', {a: 1})
  //      .add('middle', 'read', {b: 2})
  //      .add('bottom', 'read', {c: 3});
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      top: {
  //        a: null,
  //        middle: {
  //          b: null,
  //          bottom: {
  //            c: null
  //          }
  //        }
  //      }
  //    }, done);
  //  });
  //
  //  it('output is deeply nested', function () {
  //    if (asyncError) throw asyncError;
  //    var expected = {
  //      top: {
  //        a: 1,
  //        middle: {
  //          b: 2,
  //          bottom: {
  //            c: 3
  //          }
  //        }
  //      }
  //    };
  //    expect(output).toEqual(expected);
  //  });
  //
  //  it("middle handler receives top handler output as input", function () {
  //    if (asyncError) throw asyncError;
  //    expect({top: {a: 1}}).toEqual(handlers.inputs.middle.read);
  //  });
  //
  //  it("bottom handler receives middle and top handler outputs as input", function () {
  //    if (asyncError) throw asyncError;
  //    expect({
  //      top: {a: 1},
  //      middle: {b: 2}
  //    }).toEqual(handlers.inputs.bottom.read);
  //  });
  //});
  //
  //
  //describe('query with nested array that root handler fills', function () {
  //  var expected = {
  //    foo: {
  //      a: foo.a,
  //      b: foo.b,
  //      bars: [{x: 1, y: 2}, {x: 1, y: 2}]
  //    }
  //  }
  //  beforeEach(function (done) {
  //    handlers = new Handlers()
  //      .add('foo', 'read', expected.foo);
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      foo: {
  //        a: null,
  //        b: null,
  //        bars: [{
  //          x: null,
  //          y: null
  //        }]
  //      }
  //    }, done);
  //  });
  //
  //  it("fills nested shape using handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(output).toEqual(expected);
  //  });
  //});
  //
  //describe('query with nested array that secondary handler fills', function () {
  //  var expected = {
  //    foo: {
  //      a: foo.a,
  //      b: foo.b,
  //      bars: [{x: 1, y: 2}, {x: 3, y: 4}]
  //    }
  //  };
  //  beforeEach(function (done) {
  //    handlers = new Handlers()
  //      .add('foo', 'read', foo)
  //      .add('bars', 'read', [{x: 1, y: 2}, {x: 3, y: 4}]);
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      foo: {
  //        a: null,
  //        b: null,
  //        bars: [{
  //          x: null,
  //          y: null
  //        }]
  //      }
  //    }, done);
  //  });
  //
  //  it("fills nested shape using handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(expected).toEqual(output);
  //  });
  //});
  //
  //describe('parallel queries', function () {
  //  var expected = {
  //    foo: {a: 1},
  //    bar: {b: 2}
  //  };
  //  beforeEach(function (done) {
  //    var handlers = new Handlers()
  //      .add('foo', 'read', {a: 1})
  //      .add('bar', 'read', {b: 2});
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles, {
  //      foo: {a: null},
  //      bar: {b: null}
  //    }, done);
  //  });
  //
  //  it("fills nested shape using handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(output).toEqual(expected);
  //  });
  //});
  //
  //describe('parallel queries inside array query should be merged', function () {
  //  var expected = {
  //    things: [{
  //      id: 1,
  //      foo: {a: 1},
  //      bar: {b: 2}
  //    }]
  //  };
  //
  //  beforeEach(function (done) {
  //    var handlers = new Handlers()
  //      .add('things', 'read', [{id: 1}])
  //      .add('foo', 'read', {a: 1})
  //      .add('bar', 'read', {b: 2});
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles,
  //      {things: [{id: null, foo: {a: null}, bar: {b: null}}]}, done);
  //  });
  //
  //  it("fills nested shape using handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(expected).toEqual(output);
  //  });
  //});
  //
  //
  //describe('something', function () {
  //  var expected = {
  //    things: [{
  //      x: 1,
  //      foo: {a: 1}
  //    }]
  //  };
  //  var handlers = new Handlers()
  //    .add('things', 'read', [{x: 1}])
  //    .add('foo', 'read', {a: 1})
  //
  //  beforeEach(function (done) {
  //    var hurdles = hurdlesFactory(handlers.handlers);
  //    runQuery(hurdles,
  //      {things: [{x: null, foo: {a: null}}]}, done);
  //  });
  //
  //  it("foo receives input from things", function () {
  //    expect(handlers.inputs.foo.read).toEqual({things: {x: 1}});
  //  });
  //
  //  it("fills nested shape using handler", function () {
  //    if (asyncError) throw asyncError;
  //    expect(expected).toEqual(output);
  //  });
  //});
});