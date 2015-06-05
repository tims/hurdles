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
    type: type
  });
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

function handleQuery(query, type, upstream) {
  var inputs = _.isArray(query) ? getInputs(query[0]) : getInputs(query);
  _.assign(inputs, upstream || {});

  if (!handlers[type]) {
    throw new QueryException('Querying for unknown type', query, type);
  }

  console.log('handling query type =', type, ', inputs =', inputs, ', query =', query);
  return handlers[type](inputs, query).then(function (output) {
    if (_.isPlainObject(query) && !_.isPlainObject(output)) {
      throw new QueryException('Query output mismatch. Expected plain object, got '
        + JSON.stringify(output), query, type);
    } else if (_.isArray(query) && !_.isArray(output)) {
      throw new QueryException('Query output mismatch. Expected array, got '
        + JSON.stringify(output), query, type);
    }

    if (_.isPlainObject(output)) {
      output = pickFields(output, query, type);
    }

    if (_.isArray(output)) {
      output = _.map(output, function(out) {
        return pickFields(out, query[0], type);
      });
    }

    return output;
  });

};

function buildQueryPromises(query, type, parent) {
  var plan = {
    parent: parent,
    query: query,
    type: type,
    promiseFactory: type ? function (upstream) {
      return handleQuery(query, type, upstream);
    } : function() {
      return Promise.resolve({});
    }
  };
  if (_.isArray(query)) {
    plan.subQueries = _.map(getQueries(query[0]), function (subQuery, subType) {
      return buildQueryPromises(subQuery, subType, plan);
    });
  } else if (_.isPlainObject(query)) {
    plan.subQueries = _.map(getQueries(query), function (subQuery, subType) {
      return buildQueryPromises(subQuery, subType, plan);
    });
  }
  return plan;
}

function runSubPlans(plan, output, _upstream) {
  var upstream = {};
  upstream[plan.type] = _.cloneDeep(output);
  _.assign(upstream[plan.type], _upstream || {});

  return Promise.all(_.map(plan.subQueries, function(subPlan) {
    return runPlan(subPlan, upstream);
  })).then(function(subOutputs) {
    var mergedOutput = output;
    _.each(_.zipObject(_.map(plan.subQueries, 'type'), subOutputs), function (subOutput, subPlanType) {
      mergedOutput[subPlanType] = subOutput;
    });
    return mergedOutput;
  });

}

function runPlan(plan, upstream) {
  console.log('running plan', plan.type, plan.query);

  return plan.promiseFactory(upstream).then(function (output) {
    if (_.isArray(output)) {
      return Promise.all(_.map(output, function(out) {
        return runSubPlans(plan, out, upstream);
      }));
    } else {
      return runSubPlans(plan, output, upstream);
    }
  });
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
      var plan = buildQueryPromises(query, type, null);
      return runPlan(plan);
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