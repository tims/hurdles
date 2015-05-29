var server = require('./api-fake.js');

server.listen(3000, function () {
  console.log('API fake listening on port %d', server.address().port);
});

