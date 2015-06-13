var _ = require('lodash');

var queryCache = {};

function isQuery(key) {
  return key.match(/\w+\(.*\)/)
}

function getShape(queryDef) {
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
        path.push(parsed.name);
        qs = [{
          name: parsed.name,
          queryKey: key,
          queryParams: parsed.queryParams,
          path: path,
          shape: getShape(queryDef)
        }];
      } else {
        if (!_.isPlainObject(queryDef) && queryDef != null) {
          path.push(key);
          qs = [{
            name: key,
            path: path,
            shape: queryDef
          }];
        }
      }
      return qs.concat(findQueries(queryDef, path));
    }));
  }
  return queries;
}

function parseNestedQuery(queryKey, nestedQuery) {
  var fields = _.filter(_.keys(nestedQuery), function (key) {
    return !isQuery(key, nestedQuery[key]);
  });
  var children = _.map(_.filter(_.keys(nestedQuery), function (key) {
    return isQuery(key, nestedQuery[key]);
  }), function (childKey) {
    return parseNestedQuery(childKey, nestedQuery[childKey]);
  });
  return {
    action: 'get',
    name: queryKey,
    fields: fields,
    children: children
  }
}

var Home = {
  query: function () {
    return {
      'Header': Header.query(),
      'Summary': Summary.query(),
      'Bananas': [1, 2, 3, 4]
    };
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
    }
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

var homeQuery = Home.query();
console.log(JSON.stringify(homeQuery));
console.log(JSON.stringify(parseNestedQuery('root', homeQuery)));

console.log('{"============================": "============================"}');
console.log(JSON.stringify(findQueries(homeQuery)));
