var _ = require('lodash');

var _options = {};
var _handlers = {};
var _promiseCache = {};

function matchArrayQuery(key) {
  return key.match(/(\w+)\[\]/);
}

function matchObjectQuery(key) {
  return key.match(/(\w+)\(\)/);
}

function isQuery(key) {
  return key.match(/\w+(\(\)|\[\])/);
}

function getShape(queryDef) {
  if (_.isArray(queryDef) || _.isEmpty(queryDef)) {
    return queryDef;
  }

  var shape = {};
  _.each(queryDef, function (value, key) {
    if (isQuery(key)) { // TODO: And is not a mutation. We should not allow a query to fill it's children if they are mutations.
      var parsedQueryKey = parseQueryKey(key);
      if (_.isArray(parsedQueryKey.returnType)) {
        shape[parsedQueryKey.name] = [getShape(value)];
      } else {
        shape[parsedQueryKey.name] = getShape(value);
      }
    } else if (key !== '_') {
      if (_.isPlainObject(value)) {
        shape[key] = getShape(value);
      } else {
        shape[key] = value;
      }
    }
  });
  return shape;
}

function parseQueryKey(queryKey) {
  if (!isQuery(queryKey)) {
    return {};
  }

  var parsed = {
    name: queryKey,
    returnType: {}
  };

  var match;
  if (match = matchObjectQuery(queryKey)) {
    parsed.returnType = {}
  } else if (match = matchArrayQuery(queryKey)) {
    parsed.returnType = []
  }
  parsed.name = match[1];
  return parsed;
}

function findQueries(nestedQueryDef, pathSoFar) {
  //traverse the nested query definition looking for executable queries.
  if (_.isEmpty(pathSoFar)) {
    pathSoFar = [];
  }

  var queries = [];
  if (_.isArray(nestedQueryDef)) {
    // Should we allow this?
  } else {
    queries = _.flatten(_.map(nestedQueryDef, function (queryDef, key) {
      var queryDef = nestedQueryDef[key];
      var path = _.cloneDeep(pathSoFar);
      var qs = [];
      if (key === '_') {
        //skip input
      } else if (isQuery(key)) {
        var parsed = parseQueryKey(key);
        path.push(key);
        qs = [{
          name: parsed.name,
          queryKey: key,
          queryParams: (queryDef || {})._ || {},
          path: path,
          shape: getShape(queryDef)
        }];
      } else {
        path.push(key);
        if (!_.isEmpty(queryDef)) {
          qs = [{
            name: key,
            path: path,
            shape: getShape(queryDef)
          }];
        }
      }
      return qs.concat(findQueries(queryDef, path));
    }));
  }
  return queries;
}

function getHandler(name) {
  return _handlers[name] ? _handlers[name] : function (query, input) {
    return new Promise(function (resolve, reject) {
      if (query.queryKey) {
        reject(new Error('Query requires handler, but no handler found named ' + name));
      } else {
        resolve(query.shape);
      }
    });
  }
}

function handleQuery(query, input) {

  if (query.queryKey && _options.cache) {
    var cacheKey = query.path.join('.');
    _promiseCache[cacheKey] = _promiseCache[cacheKey] || getHandler(query.name)(query, input);
    return _promiseCache[cacheKey];
  }
  return getHandler(query.name)(query, input);
}

function runQueries(queries) {
  var sortedQueries = _.sortBy(queries, 'path');

  var tree = {};
  var queries = {};

  _.each(sortedQueries, function (q) {
    var parent = q.path.length <= 1 ? 'root' : _.take(q.path, q.path.length - 1).join('.');
    var child = q.path.join('.');
    queries[child] = q;
    tree[parent] = tree[parent] || [];
    tree[parent].push(child);
  });

  function processChildren(query, children, input, output, index) {
    var newInput = _.cloneDeep(input);
    newInput[query.name] = _.cloneDeep(output);
    return Promise.all(_.map(children, function (child) {
      return runTask(child, newInput, index).then(function (childOutput) {
        return {
          input: newInput,
          query: queries[child],
          output: childOutput
        }
      });
    })).then(function (summaries) {
      return _.reduce(summaries, function (acc, summary) {
        acc[summary.query.name] = summary.output;
        return acc;
      }, output)
    });
  }


  function runTask(key, input, index) {
    var query = key === 'root' ? {name: 'root', shape: {}} : queries[key];
    if (index !== undefined) {
      query = _.cloneDeep(query);
      query.path = _.take(query.path, query.path.length - 1).concat([index, _.takeRight(query.path, 1)]);
    }
    var children = tree[key];
    var promise = handleQuery(query, input);
    return promise.then(function (output) {
      if (_.isArray(output)) {
        return Promise.all(_.map(output, function (out, index) {
          if (!_.isPlainObject(out)) {
            return out;
          }
          return processChildren(query, children, input, out, index);
        }));
      } else if (_.isPlainObject(output)) {
        return processChildren(query, children, input, output);
      } else {
        return output;
      }
    });
  }

  return runTask('root', {});
}

function matchShape(shape, output) {
  var outputShape = _.cloneDeep(shape);

  if (_.isPlainObject(output)) {
    if (outputShape === null) {
      outputShape = output;
    } else {
      if (!outputShape) {
        throw new Error('cannot match output '
          + JSON.stringify(output) + ' to output shape '
          + JSON.stringify(outputShape));
      }
      _.each(output, function (value, key) {
        outputShape[key] = matchShape(shape[key], value);
      });
      outputShape = _.pick(outputShape, _.keys(shape));
      _.each(outputShape, function (value, key) {
        if (value === null) {
          throw new Error('Query output ' + JSON.stringify(output) + ' does not contain value for ' + key);
        }
      });
    }
  } else if (_.isArray(output)) {
    if (!_.isArray(shape)) {
      throw new Error('Output from handler was array, which does not match expected shape ' + JSON.stringify(shape));
    }
    if (shape.length === 1 && _.isPlainObject(shape[0])) {
      var s = shape[0];
      outputShape = _.map(output, function (o) {
        return matchShape(s, o);
      });
    } else {
      outputShape = output;
    }
  } else {
    outputShape = output;
  }
  return outputShape;
}

module.exports = function (handlers, options) {
  _handlers = handlers;
  _promiseCache = {};
  _options = _.assign({cache: true}, options || {});
  return {
    _getShape: getShape,
    _findQueries: findQueries,

    run: function (query) {
      return runQueries(findQueries(query)).then(function (output) {
        var shape = getShape(query);
        return matchShape(shape, output);
      });
    }
  }
};

