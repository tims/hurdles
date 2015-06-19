/* jslint node: true */
/* global require, describe, it, expect, beforeEach */

"use strict";

var hurdlesFactory = require('../src/hurdles');
var _ = require('lodash');

function Handler(obj) {
  this.count = 0;
  this.shapes = [];
  this.queryParamss = [];
  this.types = [];
  var self = this;

  this.handler = function (shape, queryParams, type) {
    self.count += 1;
    self.shapes.push(shape);
    self.queryParamss.push(queryParams);
    self.queryParams = queryParams;
    self.types.push(type);
    self.type = type;

    if (_.isFunction(obj)) {
      return Promise.resolve(obj(shape, queryParams));
    }
    return Promise.resolve(obj);
  };
  return this;
}


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
        recordsQueryParams: function (shape, queryParams) {
          return Promise.resolve({queryParams: queryParams});
        },
        recordsShape: function (shape, queryParams) {
          return Promise.resolve({shape: shape});
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

    it('child query params filled by parent', function (done) {
      var queryDef = {
        'foo()': {
          a: null,
          'recordsQueryParams()': {
            _: {foo: null},
            queryParams: null
          }
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect({foo: {a: 1}}).toEqual(output.foo.recordsQueryParams.queryParams);
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

    it('should fail if query parameter is null', function (done) {
      var queryDef = {
        'foo()': {
          _: {
            user: null
          },
          a: null
        }
      };
      hurdles.run(queryDef).then(function (output) {
        fail('This query should not be successful');
      }).catch(function (e) {
        expect(e.message).toEqual(jasmine.stringMatching('query parameter value for user is null'));
      }).then(done);
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
            {x: 1, foo: {a: 1, bananas: 123}},
            {x: 2, foo: {a: 1, bananas: 123}},
            {x: 3, foo: {a: 1, bananas: 123}}
          ]
        }).toEqual(output);
      }).catch(fail).then(done);
    });
  });

  describe('handlers', function () {
    var hurdles;
    var handlers;

    beforeEach(function () {
      handlers = {
        user: new Handler({id: 1, name: 'Tim'}),
        foo: new Handler({x: 1}),
        bar: new Handler({y: 2}),
        array: new Handler([{a: 1}, {a: 2}, {a: 3}]),
        arrayAPlus10: new Handler(function (shape, queryParams) {
          return {result: queryParams.array.a * 10};
        })
      };
      hurdles = hurdlesFactory({
        user: handlers.user.handler,
        foo: handlers.foo.handler,
        bar: handlers.bar.handler,
        array: handlers.array.handler,
        arrayAPlus10: handlers.arrayAPlus10.handler
      }, {cache: true});
    });

    it('should fill null query parameters with parent queries', function (done) {
      var queryDef = {
        'user()': {
          id: null,
          name: null,
          'foo()': {
            _: {
              user: null
            },
            x: null
          }
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.foo.queryParams).toEqual({
          user: {
            id: 1,
            name: 'Tim'
          }
        });
        expect(output).toEqual({
          user: {
            id: 1,
            name: 'Tim',
            foo: {
              x: 1
            }
          }
        });
      }).catch(fail).then(done);
    });

    it('should fill null query parameters with parent array queries', function (done) {
      var queryDef = {
        'array[]': {
          a: null,
          'arrayAPlus10()': {
            _: {
              array: null
            },
            result: null
          }
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect(output).toEqual({
          array: [
            {a: 1, arrayAPlus10: {result: 10}},
            {a: 2, arrayAPlus10: {result: 20}},
            {a: 3, arrayAPlus10: {result: 30}}
          ]
        });
        expect(handlers.arrayAPlus10.count).toEqual(3);
        expect(handlers.arrayAPlus10.queryParamss).toEqual([
          {array: {a: 1}},
          {array: {a: 2}},
          {array: {a: 3}}
        ])
      }).catch(fail).then(done);
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
        baz1: {'foo()': {_: {id: 1}, x: null}},
        baz2: {'foo()': {_: {id: 2}, x: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          baz1: {foo: {x: 1}},
          baz2: {foo: {x: 1}}
        }).toEqual(output);
        expect(handlers.foo.count).toEqual(2);
      }).catch(fail).then(done);
    });

    it('should execute once when called twice with the same input but different paths', function (done) {
      var queryDef = {
        baz1: {'foo()': {_: {id: 1}, x: null}},
        baz2: {'foo()': {_: {id: 1}, x: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          baz1: {foo: {x: 1}},
          baz2: {foo: {x: 1}}
        }).toEqual(output);
        expect(handlers.foo.count).toEqual(1);
      }).catch(fail).then(done);
    });

    it('should execute once when same query is run twice', function (done) {
      var queryDef = {
        'foo()': {x: null}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          foo: {x: 1}
        }).toEqual(output);
        expect(handlers.foo.count).toEqual(1);
      }).then(function () {
        return hurdles.run(queryDef)
      }).then(function (output) {
        expect({
          foo: {x: 1}
        }).toEqual(output);
        expect(handlers.foo.count).toEqual(1);
      }).catch(fail).then(done);
    });


    it('should be be called with type update', function (done) {
      var queryDef = {
        'update foo()': {_: {id: 1}, x: null}
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.foo.count).toEqual(1);
        expect(handlers.foo.type).toEqual('update');
      }).catch(fail).then(done);
    });
  });

  describe('handler returning fields based on the requested shape', function () {
    var handlers;
    var hurdles;
    beforeEach(function () {
      handlers = {
        user: new Handler(function (shape, queryParams) {
          return _.pick({id: 1, name: 'Tim'}, _.keys(shape));
        }),
        baz: new Handler({})
      };
      hurdles = hurdlesFactory({
        user: handlers.user.handler,
        baz: handlers.baz.handler,
      });
    });

    it('should provide callers with different shapes the correct shape', function (done) {
      var queryDef = {
        baz1: {'user()': {_: {id: 1}, id: null}},
        baz2: {'user()': {_: {id: 1}, name: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect({
          baz1: {user: {id: 1}},
          baz2: {user: {name: 'Tim'}}
        }).toEqual(output);
      }).catch(fail).then(done);
    });

    it('should be called once even when two queries have non overlapping shapes', function (done) {
      var queryDef = {
        baz1: {'user()': {_: {id: 1}, id: null}},
        baz2: {'user()': {_: {id: 1}, name: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.user.count).toEqual(1);
      }).catch(fail).then(done);
    });

    it('should be called once when two queries have same shapes and query param needs to be filled in by a parent', function (done) {
      var queryDef = {
        'a': {
          'baz()': {'user()': {_: {baz: null}, id: null}}
        },
        'b': {
          'baz()': {'user()': {_: {baz: null}, id: null}}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.user.count).toEqual(1);
      }).catch(fail).then(done);
    });

    it('should be called twice when two queries have different shapes and query param needs to be filled in by a parent', function (done) {
      var queryDef = {
        'a': {
          'baz()': {'user()': {_: {baz: null}, id: null}}
        },
        'b': {
          'baz()': {'user()': {_: {baz: null}, name: null}}
        }
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.user.count).toEqual(2);
      }).catch(fail).then(done);
    });

    it('should be called once when first query shape is a superset of second query', function (done) {
      var queryDef = {
        baz1: {'user()': {_: {id: 1}, id: null, name: null}},
        baz2: {'user()': {_: {id: 1}, name: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.user.count).toEqual(1);
      }).catch(fail).then(done);
    });

    it('should be called twice when first query shape is a subset of second query', function (done) {
      var queryDef = {
        baz1: {'user()': {_: {id: 1}, name: null}},
        baz2: {'user()': {_: {id: 1}, id: null, name: null}}
      };
      hurdles.run(queryDef).then(function (output) {
        expect(handlers.user.count).toEqual(1);
      }).catch(fail).then(done);
    });
  })
});