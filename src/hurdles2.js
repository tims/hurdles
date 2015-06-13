var _ = require('lodash');

var queryCache = {}

function isQuery(key) {
  return key.match(/\w+\(.*\)/)
}

function isNotQuery(key) {
  return !key.match(/\w+\(.*\)/)
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


function QueryObject(queryKey, queryFields, parent, children) {
  this.key = queryKey;

  this.merge = function (queryObject) {

  };
  return this;
}

var references = {}


function handle(key, input, shape) {
  //does handle know anything about the shape of the query?
}

var queryParams = {user: {id: 1}};


var UserInfoQuery = {
  'user(id:1)': {
    name: null,
    friendCount: null
  }
};


// pre queries: queries which are not yet fully defined as they are waiting for a parent query to complete.
// pending queries: queries which are fully defined, but not yet handled. Their own query can be cached, their children might be still pre queries..
// running queries: queries which were taken from pending are are currently executing, the have not completed their own output.
// waiting queries: queries which have completed their own output but their children are still pending or running.
// done queries: queries which have completed their own and their child queries and so have reconsituted output.


var preQueries = [
  {
    ref: 6,
    parentRef: 1,
    name: 'address',
    query: 'address(user_id:${user.id})',
    fields: {
      number: null,
      street: null,
      city: null,
      postcode: null,
      state: null,
      country: null
    }
  },
  {
    ref: 2,
    parentRef: 1,
    name: 'posts',
    query: 'posts.limit(10) map post(id:${id})', // this key is used to merge queries.
    fields: {
      id: null,
      text: null
    },
    childRefs: {
      tags: 3
    }
  },
  {
    ref: 3,
    parentRef: 2,
    key: 'tags.limit(10) as tag',
    fields: {
      id: null,
      name: null
    }
  }
];

//queryies to run
var help = [
  {
    in: {},
    query: {
      'user(id:1)': { // merged from user page and user info queries.
        id: null,
        name: null,
        friendCount: null
      }
    },
    out: {
      'user(id:1)': {
        id: 1,
        name: 'Tim',
        friendCount: 3
      }
    }
  },
  {
    in: {
      'user(id:1)': {
        id: 1,
        name: 'Tim',
        friendCount: 3
      }
    },
    query: {
      'posts(user_id:1).limit(10) as post(id)': {
        id: null,
        text: null
      }
    },
    out: [
      {
        'post(id:1)': {
          id: 1,
          text: 'foo'
        }
      }
    ]
  },
  {
    in: {
      'user(id:1)': {
        id: 1,
        name: 'Tim',
        friendCount: 3
      },
      'post(id:1)': {
        id: 1,
        text: 'foo'
      }
    },
    query: {
      'tags(post_id:1).limit(10) as tag(id)': {
        id: null,
        name: null
      }
    },
    out: [
      {
        'tag(id)': {
          id: 1,
          name: 'tag1'
        }
      },
      {
        'tag(id)': {
          id: 2,
          name: 'tag2'
        }
      }
    ]
  },
  {
    in: {
      'user(id:1)': {
        id: 1,
        name: 'Tim',
        friendCount: 3
      },
      'post(id:1)': {
        id: 1,
        text: 'foo'
      }
    },
    query: {
      'tags(post_id:1).limit(10)': {
        id: null,
        name: null
      }
    },
    out: [
      {
        'tags(post_id:1).limit(10)': [
          {
            id: 1,
            name: 'tag1'
          },
          {
            id: 1,
            name: 'tag2'
          }
        ]
      }
    ]
  }
];


var PostQuery = {
  'posts(user_id).limit(10) as post': {
    id: null,
    text: null
  }
};

var TagQuery = {
  'tags(post_id,user_id) as tag': {
    id: null,
    name: null
  }
};

var NestedQuery = {
  action: 'get',
  'user(id)': {
    id: null,
    'name': null,
    'posts.limit(10).order("asc") as post(id)': {
      'id': null,
      'text': null,
      'tags().orderBy("name") as tag(id)': {
        'id': null,
        'name': null
      }
    }
  }
};

var NestedQuery = {
  action: 'new',
  'user()': {
    'name': 'Tim'
  }
};

//
//run(queryName, queryParams, context)
//run('posts', {limit: 10, order: "asc"}, {user: {id: 1, name: 'Tim'}});
//
//run('tags', {limit: 10, orderBy: 'name', order: "asc"}, ['user(1)', 'posts().limit(10).order("asc")']);
//
//
//function run(query, input) {
//  var queryType = getQueryType(query);
//  var queryFields = []; //fields with null values.
//
//  _.map(query, function (shape, key) {
//    if (_.isArray(shape)) {
//      //do something special here
//    } else if (_.isPlainObject(shape)) {
//      var outShape = handle(key, input, shape);
//      return outShape;
//    }
//    ;
//  });
//
//  //for each field in query try to build a query for just that field?
//  //if you can't pass it to the current list of fields to be handled.
//
//  handle(name, input, fields);
//
//}