var server = require('./api.js');

server.listen(3000, function () {
  console.log('API listening on port %d', server.address().port);
});

