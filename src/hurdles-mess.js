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
  if (_.isArray(query)) {
    return Promise.resolve(upstream);
  } else {
    var inputs = getInputs(query);
    _.assign(inputs, upstream || {});

    if (!handlers[type]) {
      throw new QueryException('Querying for unknown type', query, type);
    }

    console.log('handling query type =', type, ', inputs =', inputs, ', query =', query);
    return handlers[type](inputs, query).then(function (output) {
      return pickFields(output, query, type);
    });
  }
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
    plan.subQueries = _.map(query, function (subQuery) {
      return buildQueryPromises(subQuery, null, plan);
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
  if (plan.type) {
    upstream[plan.type] = _.cloneDeep(output);
    _.assign(upstream[plan.type], _upstream || {});
  } else {
    upstream = _.assign(_.cloneDeep(output), _upstream);
  }

  return Promise.all(_.map(plan.subQueries, function(subPlan) {
    return runPlan(subPlan, upstream);
  })).then(function(subOutputs) {
    var mergedOutput;
    if (_.isArray(plan.query)) {
      mergedOutput = subOutputs;
    } else {
      _.each(_.zipObject(_.map(plan.subQueries, 'type'), subOutputs), function (subOutput, subPlanType) {
        mergedOutput[subPlanType] = subOutput;
      });
    }
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