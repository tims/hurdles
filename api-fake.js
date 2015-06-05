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
  return new Promise(function (resolve, reject) {
    resolve({
      id: 1,
      name: "Tim"
    });
  });
});


hurdles.registerHandler('dummy', function (inputs, query) {
  return new Promise(function (resolve, reject) {
    resolve({
      foo: 1,
      bar: 2
    });
  });
});


hurdles.registerHandler('salts', function (inputs, query) {
  return new Promise(function (resolve, reject) {
    var user = inputs.user || {};
    var limit = inputs.limit || 10;
    if (user.id === 1) {
      resolve(_.map(_.range(limit), function (i) {
        var text = chance.paragraph({sentences: 1});
        var datetime = moment().subtract(i, 'days');
        return {
          datetime: datetime,
          text: text
        };
      }));
    } else {
      reject(new hurdles.QueryException('Salts require user id', query, 'salts'));
    }
  });
});

hurdles.registerHandler('cogs', function (inputs, query) {
  return new Promise(function (resolve, reject) {
    var cogs = [
      {name: chance.word()},
      {name: chance.word()}
    ];
    resolve(cogs);
  });
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

app.get('/api', function (req, res) {
  res.send('I am fake.')
});

function handleQuery(type) {
  return function (req, res) {
    var query = {}
    if (req.query.q) {
      query = JSON.parse(req.query.q);
    }
    console.log('query for', type, query);
    hurdles.query(query[type], type)
      .then(function (output) {
        console.log(JSON.stringify(output));
        res.send(output);
      }).catch(function (e) {
        console.log('error', e);
        res.status(400);
        res.send(e.message + '\n');
      });
  }
}

app.get('/', function (req, res) {
  var query = {};
  if (req.query.q) {
    query = JSON.parse(req.query.q);
  }
  console.log('query for', query);
  hurdles.query(query)
    .then(function (output) {
      console.log(JSON.stringify(output));
      res.send(output);
    }).catch(function (e) {
      console.log('error', e);
      res.status(400);
      res.send(e.message + '\n');
    });
});


module.exports = http.createServer(app);
