'use strict';

var express = require('express');
var http = require('http');
var cors = require('cors');
var fs = require('fs');
var bodyParser = require('body-parser');
var _ = require('lodash');


var counter = 0;
var hurdles = require('./hurdles')({
  foo: function (query, input) {
    return Promise.resolve({a: 1});
  },
  bar: function (query, input) {
    return Promise.resolve({b: 2});
  },
  count: function(query, input) {
    counter++;
    return Promise.resolve(counter);
  },
  bars: function(query, input) {
    return Promise.resolve([{b: 1}, {b:2}]);
  },
  user: function (query, input) {
    if (query.queryParams.id === 1) {
      return Promise.resolve({id: 1, name: 'Tim'})
    } else {
      throw new Error('User not found');
    }
  }
});

var app = express();
app
  .use(cors())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({
    extended: true
  }));

function handleResponse(promise, res) {
  promise.then(function (output) {
    console.log('OUTPUT', JSON.stringify(output));
    res.send(output);
  }).catch(function (e) {
    console.error('error', e.stack);
    res.status(400);
    res.send(e.message + '\n');
  });
}

app.post('/', function (req, res) {
  var query = req.body;
  console.log(req);
  console.log('QUERY', query);
  handleResponse(hurdles.run(query), res);
});

var server = http.createServer(app);
server.listen(3000, function () {
  console.log('API listening on port %d', server.address().port);
});

