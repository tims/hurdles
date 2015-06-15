var hurdlesFactory = require('../src/hurdles');
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


});