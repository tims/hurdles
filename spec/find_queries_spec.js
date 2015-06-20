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
        type: 'get',
        shape: null
      }]).toEqual(tasks);
    });

    it('finds "new" query', function () {
      var hurdles = hurdlesFactory({});

      var queryDef = {
        'new foo()': null
      };
      var tasks = hurdles._findQueries(queryDef, ['root']);
      expect([{
        name: 'foo',
        queryKey: 'new foo()',
        queryParams: Object({}),
        path: ['root', 'new foo()'],
        type: 'new',
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
        type: 'get',
        shape: {bar: null}
      }, {
        name: 'bar',
        queryKey: 'bar()',
        queryParams: Object({}),
        path: ['root', 'foo()', 'bar()'],
        type: 'get',
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
        type: 'get',
        shape: null
      }, {
        name: 'bar',
        queryKey: 'bar()',
        queryParams: Object({}),
        path: ['root', 'bar()'],
        type: 'get',
        shape: null
      }]).toEqual(tasks);
    });

    it('ignore input object', function () {
      var hurdles = hurdlesFactory({});
      var queryDef = {
        'foo()': {
          _: {bar: {x: 1}},
          y: null
        },
      };
      var tasks = hurdles._findQueries(queryDef, ['root']);
      console.log(JSON.stringify(tasks));

      expect([{
        name: 'foo',
        queryKey: 'foo()',
        queryParams: {bar: {x: 1}},
        path: ['root', 'foo()'],
        type: 'get',
        shape: {y: null}
      }]).toEqual(tasks);
    });
  });
});