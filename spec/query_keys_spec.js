/* jslint node: true */
/* global require, describe, it, expect, beforeEach */

"use strict";

var hurdlesFactory = require('../src/hurdles');
var _ = require('lodash');

describe('parsing query keys', function () {
  var hurdles = hurdlesFactory({});

  it('detects non query', function () {
    expect(hurdles._parseQueryKey('foo'))
      .toEqual({});
  });

  it('detects get object query', function () {
    expect(hurdles._parseQueryKey('foo()'))
      .toEqual({
        name: 'foo',
        returnType: {},
        type: 'get'
      });
  });

  it('detects get object query with keyword', function () {
    expect(hurdles._parseQueryKey('get foo()'))
      .toEqual({
        name: 'foo',
        returnType: {},
        type: 'get'
      });
  });

  it('detects new object query with keyword', function () {
    expect(hurdles._parseQueryKey('new foo()'))
      .toEqual({
        name: 'foo',
        returnType: {},
        type: 'new'
      });
  });

  it('detects update object query with keyword', function () {
    expect(hurdles._parseQueryKey('update foo()'))
      .toEqual({
        name: 'foo',
        returnType: {},
        type: 'update'
      });
  });

  it('detects delete object query with keyword', function () {
    expect(hurdles._parseQueryKey('delete foo()'))
      .toEqual({
        name: 'foo',
        returnType: {},
        type: 'delete'
      });
  });

  it('detects get array query', function () {
    expect(hurdles._parseQueryKey('foo[]'))
      .toEqual({
        name: 'foo',
        returnType: [],
        type: 'get'
      });
  });
});