/* jslint node: true */
/* global require, describe, it, expect, beforeEach */

"use strict";

var hurdlesFactory = require('../src/hurdles');
var _ = require('lodash');

describe('hurdles', function () {
  var output;
  var asyncError;

  beforeEach(function () {
    output = null;
    asyncError = null;
  });

  describe('getShape', function () {
    it('should leave values alone', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({foo: 1})).toEqual({foo: 1});
      expect(hurdles._getShape({foo: null})).toEqual({foo: null});
      expect(hurdles._getShape({foo: 'test'})).toEqual({foo: 'test'});
    });

    it('should leave arrays of values alone', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should reduce calls to their name', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({'a()': null})).toEqual({a: null});
    });

    it('should reduce nested calls to their nested names', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({'a()': {'b()': null}})).toEqual({a: {b: null}});
    });

    it('array values should be treated as constants', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({
        a: [{'thisshouldnotchange()': null}]
      })).toEqual({
        a: [{'thisshouldnotchange()': null}]
      });
    });

    it('should return array for array queries', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({
        'a[]': {a: null}
      })).toEqual({
        a: [{a: null}]
      });
    });

    it('should strip query parameters from queries', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({
        'a()': {_: {id: 1}, a: null}
      })).toEqual({
        a: {a: null}
      });
    });

    it('should strip query parameters from array queries', function () {
      var hurdles = hurdlesFactory({});
      expect(hurdles._getShape({
        'a[]': {_: {id: 1}, a: null}
      })).toEqual({
        a: [{a: null}]
      });
    });
  });

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
        recordsShape: function (query, input) {
          return Promise.resolve({input: query.shape});
        },
        array: function () {
          return Promise.resolve([1, 2, 3]);
        },
        arrayOfObjects: function () {
          return Promise.resolve([{x: 1}, {x: 2}, {x: 3}]);
        },
        user: function () {
          return Promise.resolve({id: 1, name: 'Tim'});
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

    it('knows that input should not be treated as a constant and thus should not be in the output', function (done) {
      var queryDef = {
        'foo()': {
          _: {id: 123},
          a: null
        },
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a: 1}}).toEqual(output);
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
        'array[]': null
      };
      hurdles.run(queryDef).then(function (output) {
        expect({array: [1, 2, 3]}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('children get applied to each element of parent\'s output array', function (done) {
      var queryDef = {
        'arrayOfObjects[]': {
          'foo()': {a: null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {foo: {a: 1}},
            {foo: {a: 1}},
            {foo: {a: 1}}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('children get input from each element of parent\'s output array', function (done) {
      var queryDef = {
        'arrayOfObjects[]': {
          'recordsInput()': {input: null}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {recordsInput: {input: {arrayOfObjects: {x: 1}, root: {}}}},
            {recordsInput: {input: {arrayOfObjects: {x: 2}, root: {}}}},
            {recordsInput: {input: {arrayOfObjects: {x: 3}, root: {}}}}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('can define constants', function (done) {
      var queryDef = {
        'bla': 1
      };
      hurdles.run(queryDef).then(function (output) {
        expect({bla: 1}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('can define constants within a query', function (done) {
      var queryDef = {
        'foo()': {
          a: null,
          x: 1
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a: 1, x: 1}}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('limits the fields to the requested shape', function (done) {
      var queryDef = {
        'user()': {
          name: null
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({user: {name: 'Tim'}}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('fails if requesting more fields in the shape than are available', function (done) {
      var queryDef = {
        'user()': {
          id: null,
          name: null,
          dateOfBirth: null
        }
      };
      hurdles.run(queryDef).then(function (output) {
        fail('expected rejection because dateOfBirth isn\'t available');
      }).catch(function (e) {
        expect(e.message).toEqual(jasmine.stringMatching('does not contain value for dateOfBirth'));
      }).then(done);
    });

    it('should override shape constants with output', function (done) {
      var queryDef = {
        'foo()': {
          a: 5
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a: 1}}).toEqual(output);
      }).catch(fail).then(done);
    });

    it('should include constants from shape within an array query', function (done) {
      var queryDef = {
        'arrayOfObjects[]': {
          x: null,
          y: 1
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {x: 1, y: 1},
            {x: 2, y: 1},
            {x: 3, y: 1}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('should include constants from nested query within array query', function (done) {
      var queryDef = {
        'arrayOfObjects[]': {
          x: null,
          'foo()': {
            a: null,
            bananas: 123
          }
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          arrayOfObjects: [
            {
              x: 1,
              foo: {
                a: 1,
                bananas: 123
              }
            },
            {
              x: 2,
              foo: {
                a: 1,
                bananas: 123
              }
            },
            {
              x: 3,
              foo: {
                a: 1,
                bananas: 123
              }
            }
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });
  });

  describe('handlers', function () {
    var hurdles;
    var handlers;

    function Handler(obj) {
      this.count = 0;
      var self = this;
      this.handler = function () {
        self.count += 1;
        if (_.isFunction(obj)) {
          return Promise.resolve(obj(self.count));
        }
        return Promise.resolve(obj);
      };
      return this;
    }


    beforeEach(function () {
      handlers = {
        foo: new Handler({x: 1}),
        bar: new Handler({y: 2}),
        counter: new Handler(function (count) {
          return {count: count}
        })
      };
      hurdles = hurdlesFactory({
        foo: handlers.foo.handler,
        bar: handlers.bar.handler,
        counter: handlers.counter.handler
      });
    });

    it('should execute once when called once', function (done) {
      var queryDef = {
        'foo()': {
          x: null,
          'bar()': {
            y: null
          }
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          foo: {
            x: 1,
            bar: {
              y: 2
            }
          }
        }).toEqual(output);
        expect(handlers.foo.count).toEqual(1);
        expect(handlers.bar.count).toEqual(1);
      }).catch(fail).then(done);
    });

    it('should execute twice when called twice with different input', function (done) {
      var queryDef = {
        baz1: {'counter()': {_: {id: 1}, count: null}},
        baz2: {'counter()': {_: {id: 2}, count: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          baz1: {counter: {count: 1}},
          baz2: {counter: {count: 2}}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(2);
      }).catch(function (e) {
        console.log(e.stack);
        fail(e);
      }).then(done);
    });

    it('should execute twice when called twice with the same input but different paths', function (done) {
      var queryDef = {
        baz1: {'counter()': {_: {id: 1}, count: null}},
        baz2: {'counter()': {_: {id: 1}, count: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          baz1: {counter: {count: 1}},
          baz2: {counter: {count: 2}}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(2);
      }).catch(fail).then(done);
    });

    it('should execute once when same query is run twice', function (done) {
      var queryDef = {
        'counter()': {count: null}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          counter: {count: 1}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(1);
      }).then(function () {
        return hurdles.run(queryDef)
      }).then(function (output) {
        expect({
          counter: {count: 1}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(1);
      }).catch(fail).then(done);
    });

  });

  describe('handlers with caching disabled', function () {
    var hurdles;
    var handlers;

    function Handler(obj) {
      this.count = 0;
      var self = this;
      this.handler = function () {
        self.count += 1;
        if (_.isFunction(obj)) {
          return Promise.resolve(obj(self.count));
        }
        return Promise.resolve(obj);
      };
      return this;
    }


    beforeEach(function () {
      handlers = {
        foo: new Handler({x: 1}),
        bar: new Handler({y: 2}),
        counter: new Handler(function (count) {
          return {count: count}
        })
      };
      hurdles = hurdlesFactory({
        foo: handlers.foo.handler,
        bar: handlers.bar.handler,
        counter: handlers.counter.handler
      }, {cache: false});
    });

    it('should execute twice when same query is run twice with caching disabled', function (done) {
      var queryDef = {
        'counter()': {count: null}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          counter: {count: 1}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(1);
      }).then(function () {
        return hurdles.run(queryDef)
      }).then(function (output) {
        expect({
          counter: {count: 2}
        }).toEqual(output);
        expect(handlers.counter.count).toEqual(2);
      }).catch(fail).then(done);
    });
  });
});