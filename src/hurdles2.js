var _ = require('lodash');

var queryCache = {};

function isQuery(key) {
  return key.match(/\w+\(.*\)/)
}

function getShape(queryDef) {
  if (_.isArray(queryDef) || _.isEmpty(queryDef)) {
    return queryDef;
  }

  var shape = {}
  _.each(queryDef, function (value, key) {
    if (isQuery(key)) { // TODO: And is not a mutation. We should not allow a query to fill it's children if they are mutations.
      shape[parseQueryKey(key).name] = getShape(value);
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
    queryParams: {}
  };

  var match = queryKey.match(/(\w+)\(((\w+:[<\w>]+?)?(,\w+:[<\w>]+)*)\)/);
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

  var queries = []
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

//
//function parseNestedQuery(queryKey, nestedQuery) {
//  var fields = _.filter(_.keys(nestedQuery), function (key) {
//    return !isQuery(key, nestedQuery[key]);
//  });
//  var children = _.map(_.filter(_.keys(nestedQuery), function (key) {
//    return isQuery(key, nestedQuery[key]);
//  }), function (childKey) {
//    return parseNestedQuery(childKey, nestedQuery[childKey]);
//  });
//  return {
//    action: 'get',
//    name: queryKey,
//    fields: fields,
//    children: children
//  }
//}

function runQuery(query, input) {

}

var handlers = {
  'root': function (query, input) {
    return Promise.resolve({});
  },
  'posts': function (query, input) {
    //console.log('posts received input', input);
    return Promise.resolve([{id:1}, {id:2}]);
  },
  'user': function (query, input) {
    //console.log('user received input', input);
    return Promise.resolve(query.shape);
  },
  'cogs': function (query, input) {
    console.log('cogs received input', input);
    return Promise.resolve(query.shape);
  },
  'x': function (query, input) {
    //console.log('x received input', input);
    return Promise.resolve(query.shape);
  }
};

function getHandler(name) {
  return handlers[name] ? handlers[name] : function (query, input) {
    return new Promise(function (resolve, reject) {
      if (query.queryKey) {
        //console.log('rejecting', query.queryKey);
        reject(new Error('Query requires handler, but no handler found named ' + name));
      } else {
        console.log('resolving', query, query.queryKey);
        resolve(query.shape);
      }
    });
  }
}

function runQueries(queries) {
  var runningTasks = {};

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

  function runTask(key, input) {
    var query = key === 'root' ? {name: 'root'} : queries[key];
    //console.log('key', key);
    //console.log('query.name', query.name);
    //console.log('query.path', query.path);
    //console.log('query.queryKey', query.queryKey);

    var children = tree[key];
    var handler = getHandler(query.name);
    return handler(query, input).then(function (output) {
      //if (_.isArray(output)) {
      //  _.each(output, function (out) {
      //    var newInput = _.cloneDeep(input);
      //    newInput[query.name] = out;
      //    runTask(child, newInput)
      //  });
      //}


      if (_.isArray(output)) {
        console.log('I am output!', output);
        return Promise.all(_.map(output, function (out) {
          if (!_.isPlainObject(out)) {
            return out;
          }
          var newInput = _.cloneDeep(input);
          newInput[query.name] = _.cloneDeep(out);
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
            }, out)
          });
        }));
      }

      if (_.isPlainObject(output)) {
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
    });
  }

  console.log(JSON.stringify(tree));

  //console.log(["=========================="]);
  runTask('root', {}).then(function (output) {
    console.log(JSON.stringify(output));
  }).catch(function (e) {
    console.error('error', e.stack);
  });

  //_.each(queries, function(query) {
  //
  //});
}

var Home = {
  query: function (userId) {
    var q = {
      'Header': Header.query(),
      'Summary': Summary.query(),
      'Bananas': [1, 2, 3, 4]
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
      'posts(user_id:<user_id>,limit:10)[]': Post.query()
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

var homeQuery = Home.query(1);
console.log(JSON.stringify(homeQuery));
//console.log(JSON.stringify(parseNestedQuery('root', homeQuery)));

var queries = findQueries(homeQuery);
console.log(JSON.stringify(queries));

runQueries(queries);
