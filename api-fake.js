'use strict';

var express = require('express');
var http = require('http');
var cors = require('cors');
var fs = require('fs');
var bodyParser = require('body-parser');
var moment = require('moment');
var _ = require('lodash');
var chance = require('chance')();

var hurdles = require('./hurdles');

hurdles.registerHandler('user', function (inputs, query) {
  if (false) { //query["!salts"]) {
    // Do some custom query that fetches salts and the user at the same time.
    return _.extend(User.find({id: inputs.id}), {salts: Salts.find({userId: query.id})});
  } else {
    return {
      name: "Tim"
    };
  }
});

hurdles.registerHandler('salts', function (inputs, query) {
  console.log('handling salts', query);
  var user = inputs.user || {};
  var limit = inputs.limit || 10;
  if (user.id === 1) {
    console.log('handling salts', query);
    return _.map(_.range(limit), function (i) {
      var text = chance.paragraph({sentences: 1});
      var datetime = moment().subtract(i, 'days');
      return {
        datetime: datetime,
        text: text
      };
    });
  } else {
    throw new hurdles.QueryException('Salts require user id', query, 'salts');
  }
});

hurdles.registerHandler('cogs', function(inputs, query) {
  var cogs = [
    {name: chance.word()},
    {name: chance.word()}
  ];
  return cogs;
});

var always200 = function (req, res) {
  res.send('OK');
};

var always400 = function (req, res) {
  setTimeout(function () {
    res.status(400);
    res.send({message: 'Not OK!'});
  }, 0);
};

var app = express();

app
  .use(cors())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({
    extended: true
  }));

app.get('/', always200);

app.get('/api', function (req, res) {
  res.send('I am fake.')
});

app.get('/user', function (req, res) {
  var query = JSON.parse(req.query.q);
  var output = {user: hurdles.query(query, 'user')};
  res.send(output);
});

function handleQuery(type) {
  return function (req, res) {
    var query = JSON.parse(req.query.q);
    var output = {};
    try {
      output[type] = hurdles.query(query, type);
      console.log('all good');
      res.send(output);
    } catch (e) {
      console.log('error', e);
      res.status(400);
      //res.send(e.message + '\n');
      throw e;
    }
  }
}

app.get('/user', handleQuery('user'));
app.get('/salts', handleQuery('salts'));


module.exports = http.createServer(app);
