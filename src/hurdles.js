var _ = require('lodash');

var _options = {};
var _handlers = {};

function matchArrayQuery(key) {
  return key.match(/(get|new|update|delete)?\s*(\w+)\[\]/);
}

function matchObjectQuery(key) {
  return key.match(/(get|new|update|delete)?\s*(\w+)\(\)/);
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
  parsed.name = match[2];
  var types = ['new', 'update', 'delete', 'get'];
  if (_(types).contains(match[1])) {
    parsed.type = match[1];
  } else {
    parsed.type = 'get';
  }
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
          shape: getShape(queryDef),
          type: parsed.type
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

/* Merge shapes of queries which have completed inputs and build their promises. */
function preCacheQueries(queries) {
  var groupBy = {};
  _.each(queries, function (query) {
    if (!query.queryKey) {
      return;
    }
    var hasAllValues = _.reduce(_.values(query.queryParams), function (acc, val) {
      return acc && (val !== null);
    }, true);
    if (hasAllValues) {
      var cacheKey = _executionCache.getKey(query);
      groupBy[cacheKey] = groupBy[cacheKey] || [];
      groupBy[cacheKey].push(query);
    }
  });

  _.each(groupBy, function (groupedQueries, key) {
    var aggregateShape = _.reduce(_.map(groupedQueries, 'shape'), _.assign, {});
    var query = _.cloneDeep(groupedQueries[0]);
    query.shape = aggregateShape;
    _executionCache.execute(query);
  });
}

function getHandler(name, queryKey) {
  return _handlers[name] ? _handlers[name] : function (shape, queryParams) {
    return new Promise(function (resolve, reject) {
      if (queryKey) {
        reject(new Error('Query requires handler, but no handler found named ' + name));
      } else {
        resolve(shape);
      }
    });
  }
}

/* Takes queries and stores their results collected by query name and query parameters */
function ExecutionCache() {
  var cache = {};

  function getKey(query) {
    return query.queryKey + '(' + JSON.stringify(query.queryParams) + ')'
  }

  function get(query) {
    return cache[getKey(query)]
  }

  this.execute = function (query) {
    var query = _.cloneDeep(query);
    var execution = get(query);
    if (execution) {
      var requestedKeys = _.keys(query.shape);
      if (_.intersection(_.keys(execution.shape), requestedKeys).length != requestedKeys.length) {
        // TODO we probably should also merge the nested shape
        var newShape = _.assign(execution.shape, query.shape);
        query.shape = newShape;
        execution = {
          shape: newShape,
          promise: getHandler(query.name, query.queryKey)(query.shape, query.queryParams, query.type)
        }
      }
    } else {
      execution = {
        shape: query.shape,
        promise: getHandler(query.name, query.queryKey)(query.shape, query.queryParams, query.type)
      };
    }
    cache[getKey(query)] = execution;
    return execution;
  };

  this.get = get;
  this.getKey = getKey;
  return this;
}
var _executionCache = new ExecutionCache();

function handleQuery(query) {
  var query = _.cloneDeep(query);
  _.each(query.queryParams, function (value, key) {
    if (value === null || value === undefined) {
      if (_.contains(_.keys(query.parentOutput), key)) {
        query.queryParams[key] = _.cloneDeep(query.parentOutput[key]);
      } else {
        throw new Error('query parameter value for ' + key + ' is ' + value);
      }
    }
  });

  var promise;
  if (query.queryKey && _options.cache) {
    var execution = _executionCache.execute(query);
    promise = execution.promise;
  } else {
    promise = getHandler(query.name)(query.shape, query.queryParams, query.type);
  }
  return promise;
}

function runQueries(queries) {
  if (_options.cache) {
    preCacheQueries(queries);
  }
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

  function processChildren(query, children, output, index) {
    var parentOutput = _.cloneDeep(query.parentOutput || {});
    parentOutput[query.name] = output;

    return Promise.all(_.map(children, function (child) {
      return runTask(child, parentOutput, index).then(function (childOutput) {
        return {
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


  function runTask(key, parentOutput, index) {
    var query = key === 'root' ? {name: 'root', shape: {}} : queries[key];
    query = _.cloneDeep(query);
    query.parentOutput = parentOutput;

    if (index !== undefined) {
      query.path = _.take(query.path, query.path.length - 1).concat([index, _.takeRight(query.path, 1)]);
    }
    var children = tree[key];
    var promise = handleQuery(query);
    return promise.then(function (output) {
      if (_.isArray(output)) {
        return Promise.all(_.map(output, function (out, index) {
          if (!_.isPlainObject(out)) {
            return out;
          }
          return processChildren(query, children, out, index);
        }));
      } else if (_.isPlainObject(output)) {
        return processChildren(query, children, output);
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
  _executionCache = new ExecutionCache();
  _options = _.assign({cache: true}, options || {});
  return {
    _getShape: getShape,
    _findQueries: findQueries,
    _parseQueryKey: parseQueryKey,

    run: function (query) {
      return runQueries(findQueries(query)).then(function (output) {
        var shape = getShape(query);
        return matchShape(shape, output);
      });
    }
  }
};
