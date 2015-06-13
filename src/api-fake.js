'use strict';

var express = require('express');
var http = require('http');
var cors = require('cors');
var fs = require('fs');
var bodyParser = require('body-parser');
var moment = require('moment');
var _ = require('lodash');
var chance = require('chance')();

var handlers = require('./handlers');
var hurdles = require('./hurdles')(handlers);


var app = express();
app
  .use(cors())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({
    extended: true
  }));

var always200 = function (req, res) {
  res.send('OK');
};

var always400 = function (req, res) {
  setTimeout(function () {
    res.status(400);
    res.send({message: 'Not OK!'});
  }, 0);
};


app.get('/api', function (req, res) {
  res.send('I am fake.')
});

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

app.post('/', function(req, res) {
  var query = req.body;
  console.log('QUERY', query);
  handleResponse(hurdles.run(query), res);
});

app.get('/', function (req, res) {
  console.log('/', JSON.stringify(req.query));
  var query = {};
  if (req.query.q) {
    query = JSON.parse(req.query.q);
  }
  console.log('QUERY', query);
  handleResponse(hurdles.run(query), res);
});

module.exports = http.createServer(app);
