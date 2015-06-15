var _ = require('lodash');

function matchArrayQuery(key) {
  return key.match(/(\w+)\[((\w+:[<\w>]+?)?(,\w+:[<\w>]+)*)\]/);
}

function matchObjectQuery(key) {
  return key.match(/(\w+)\(((\w+:[<\w>]+?)?(,\w+:[<\w>]+)*)\)/);
}

function isQuery(key) {
  return key.match(/\w+(\(.*\)|\[.*\])/);
}

function getShape(queryDef) {
  if (_.isArray(queryDef) || _.isEmpty(queryDef)) {
    return queryDef;
  }

  var shape = {};
  _.each(queryDef, function (value, key) {
    console.log(key);
    if (isQuery(key)) { // TODO: And is not a mutation. We should not allow a query to fill it's children if they are mutations.
      console.log(key, 'is query');
      var parsedQueryKey = parseQueryKey(key);
      console.log(queryDef, parsedQueryKey)
      if (_.isArray(parsedQueryKey.returnType)) {
        console.log('i am array query!!!!');
        shape[parsedQueryKey.name] = [getShape(value)];
      } else {
        shape[parsedQueryKey.name] = getShape(value);
      }
    } else if (_.isPlainObject(value)) {
      shape[key] = getShape(value);
    } else {
      shape[key] = value;
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
    queryParams: {},
    returnType: {}
  };

  var match = null;
  if (match = matchObjectQuery(queryKey)) {
    parsed.returnType = {}
  } else if (match = matchArrayQuery(queryKey)) {
    parsed.returnType = []
  }
  parsed.name = match[1];
  if (!_.isEmpty(match[2])) {
    _.each(match[2].split(','), function (arg) {
      var pair = arg.split(':');
      parsed.queryParams[pair[0]] = pair[1];
    });
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
      if (isQuery(key)) {
        var parsed = parseQueryKey(key);
        path.push(key);
        qs = [{
          name: parsed.name,
          queryKey: key,
          queryParams: parsed.queryParams,
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

var _handlers = {
  'root': function (query, input) {
    return Promise.resolve({});
  },
  'posts': function (query, input) {
    //console.log('posts received input', input);
    return Promise.resolve([{id: 1, text: 'iamtext'}, {id: 2,text:'ibetext'}]);
  },
  'user': function (query, input) {
    //console.log('user received input', input);
    return Promise.resolve(query.shape);
  },
  'cogs': function (query, input) {
    //console.log('cogs received input', input);
    return Promise.resolve({name:'iamcog'});
  },
  'x': function (query, input) {
    //console.log('x received input', input);
    return Promise.resolve(query.shape);
  },
  'hmm': function (query, input) {
    //console.log('x received input', input);
    return Promise.resolve(123);
  }
};

function getHandler(name) {
  return _handlers[name] ? _handlers[name] : function (query, input) {
    return new Promise(function (resolve, reject) {
      if (query.queryKey) {
        //console.log('rejecting', query.queryKey);
        reject(new Error('Query requires handler, but no handler found named ' + name));
      } else {
        //console.log('resolving query shape', query.shape);
        //console.log('resolving', query, query.queryKey);
        resolve(query.shape);
      }
    });
  }
}

function runQueries(queries) {
  var sortedQueries = _.sortBy(queries, 'path');

  var tree = {};
  var queries = {}

  _.each(sortedQueries, function (q) {
    var parent = q.path.length <= 1 ? 'root' : _.take(q.path, q.path.length - 1).join('.');
    var child = q.path.join('.');
    queries[child] = q;
    tree[parent] = tree[parent] || [];
    tree[parent].push(child);
  });

  function processChildren(query, children, input, output) {
    var newInput = _.cloneDeep(input);
    newInput[query.name] = _.cloneDeep(output);
    return Promise.all(_.map(children, function (child) {
      return runTask(child, newInput).then(function (childOutput) {
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


  function runTask(key, input) {
    var query = key === 'root' ? {name: 'root', shape: {}} : queries[key];

    //console.log('key', key);
    //console.log('query.name', query.name);
    //console.log('query.path', query.path);
    //console.log('query.queryKey', query.queryKey);

    var children = tree[key];
    var handler = getHandler(query.name);
    return handler(query, input).then(function (output) {
      if (_.isArray(output)) {
        //console.log('runTask, output array, now running children');
        return Promise.all(_.map(output, function (out) {
          if (!_.isPlainObject(out)) {
            return out;
          }
          return processChildren(query, children, input, out);
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
      _.each(output, function(value, key) {
        if (!outputShape) {
          console.log('cannot set key out output shape', outputShape);
          console.log('cannot set key out output shape', key);
          console.log('cannot set key out output shape', output);
        }
        outputShape[key] = matchShape(shape[key], value);
      });
      outputShape = _.pick(outputShape, _.keys(shape));
    }
  } else {
    outputShape = output;
  }
  return outputShape;
}

var Home = {
  query: function (userId) {
    var q = {
      //'Header': Header.query(),
      'Summary': Summary.query(),
      //'Bananas': [1, 2, 3, 4],
      //'hmm()': null
    };

    return JSON.parse(JSON.stringify(q).replace(new RegExp('<user_id>', 'g'), userId));
  }
};

var Header = {
  query: function () {
    return {
      'user(id:<user_id>)': {
        name: null,
        foo: {
          'x()': {i: null},
          y: 3
        }
      }
    };
  }
};

var Summary = {
  query: function () {
    return {
      'posts(user_id:<user_id>,limit:10)[]': Post.query(),
      baz: 1
    };
  }
};

var Post = {
  query: function () {
    return {
      id: null,
      text: null,
      'cogs(limit:3)': {
        name: null
      }
    }
  }
};

var PostPage = {
  query: function () {
    return {
      'post(id:<id>)': Post.query()
    }.query();
  }
};

var rootQuery = {
  'Home': {
    'Header': {
      'user(id:1)': {
        name: null
      }
    },
    'Summary': {
      'posts(user_id:<user_id>,limit:10) as post': {
        id: null,
        text: null,
        'cogs(limit:3)': {
          name: null
        }
      }
    }
  }
};

module.exports = function (handlers) {
  _handlers = handlers;
  return {
    _getShape: getShape,
    _findQueries: findQueries,

    run: function (query) {
      console.log('running query', query);
      return runQueries(findQueries(query)).then(function(output) {
        var shape = getShape(query);
        console.log('shape', shape);
        return matchShape(shape, output);
      }).catch(function(e){
        console.error(e.stack);
        throw e;
      });
    }
  }
};

var queryDef = {a:1};
runQueries(findQueries(queryDef)).then(function (output) {
  var shape = getShape(queryDef);
  var outputShape = matchShape(shape, output);
  console.log(JSON.stringify(shape));
  console.log(JSON.stringify(output));
  console.log(JSON.stringify(outputShape));
});

