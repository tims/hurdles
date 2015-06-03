var _ = require('lodash');

//var exampleQuery = {
//  user: {
//    "_id": 101,
//    "_cogId": 200,
//    "id": null,
//    "name": null,
//    "dateOfBirth": null,
//    "salts": [
//      {
//        _userId: 101,
//        "text": null,
//        "cogs": [
//          {
//            "id": null,
//            "name": null
//          }
//        ]
//      }
//    ],
//  }
//};

function QueryException(message, query, type) {
  self = this;
  _.assign(this, {
    message: message,
    query: query,
    type: type,
    qualifiedQuery: query,
    qualifiedType: type,
    qualifyQuery: function (parentQuery, parentType) {
      self.qualifiedQuery = parentQuery;
      if (parentType) {
        self.qualifiedType = parentType + '.' + self.qualifiedType;
      }
    }
  });
}

function executeNestedQuery(query, type, parentOutput) {
  console.log('executeNestedQuery', query, type);
  var output = {};
  _.each(getQueries(query), function (nestedQuery, nestedType) {
    try {
      nestedQuery['_' + type] = parentOutput;
      output[nestedType] = executeQuery(nestedQuery, nestedType);
    } catch (e) {
      if (e.qualifyQuery !== undefined) {
        e.qualifyQuery(query, type);
      }
      throw e;
    }
  });
  return output;
}

function pickFields(output, query, type) {
  var expectedFields = _.filter(_.keys(query), function (key) {
    return query[key] == null
  });
  _.each(expectedFields, function (key) {
    if (!output[key]) {
      throw new QueryException('Query output for ' + type + ' is missing field: ' + key + '. Got: '
        + JSON.stringify(output), query, type);
    }
  });
  return _.pick(output, expectedFields);
}

function handleQueryType(query, type) {
  var inputs = {};
  if (_.isArray(query)) {
    inputs = getInputs(query[0]);
  } else {
    inputs = getInputs(query);
  }

  if (!handlers[type]) {
    throw new QueryException('Querying for unknown type', query, type);
  }
  console.log('handling query type =', type, ', inputs =', inputs, ', query =', query);
  return handlers[type](inputs, query);
};

function executeQuery(query, type) {
  var output = {};

  if (type) {
    output = handleQueryType(query, type);
    if (_.isPlainObject(query)) {
      if (!_.isPlainObject(output)) {
        throw new QueryException('Query output mismatch. Expected plain object, got '
          + JSON.stringify(output), query, type);
      }
      output = pickFields(output, query, type);
      _.assign(output, executeNestedQuery(query, type, output));
    } else if (_.isArray(query)) {
      if (!_.isArray(output)) {
        throw new QueryException('Query output mismatch. Expected array, got '
          + JSON.stringify(output), query, type);
      }
      output = _.map(output, function (item) {
        var o = pickFields(item, query[0], type);
        _.assign(o, executeNestedQuery(query[0], type, output));
        return o;
      });
    } else {
      throw new QueryException('Cannot execute query: ' + JSON.stringify(query), query, type);
    }
  } else {
    output = _.cloneDeep(query);
    _.assign(output, executeNestedQuery(query, type, output));
  }
  return output;
}

function getInputs(query) {
  var inputs = {};
  _.each(_.pick(query, _.filter(_.keys(query), function (a) {
    return _(a).startsWith('_')
  })), function (val, key) {
    inputs[key.match(/_(.*)/)[1]] = val;
  });
  return inputs;
}

function getQueries(query) {
  return _.pick(query, _.filter(_.keys(query), function (key) {
    return !_(key).startsWith('_') && (_.isPlainObject(query[key]) || _.isArray(query[key]));
  }))
}

var handlers = {};

module.exports = {
  QueryException: QueryException,

  registerHandler: function (type, handler) {
    handlers[type] = handler;
  },

  query: function (query, type) {
    try {
      return executeQuery(query, type);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
};

// TODO: TESTS!
// TODO:
//   Add input field into output without having to redeclare them.
//   Then assert that they actually match so you can't return an object with the wrong id.
// TODO:
//   Use promises.
// TODO:
//   Propagate outputs of parent queries into inputs of child queries.
// TODO:
//   Automatically subscribe clients to stores somehow.