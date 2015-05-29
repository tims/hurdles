'use strict';

var express = require('express');
var http = require('http');
var cors = require('cors');
var fs = require('fs');
var bodyParser = require('body-parser');
var moment = require('moment');
var _ = require('lodash');


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

module.exports = http.createServer(app);
