module.export = {
  foo: function(query, input) {
    return new Promise.resolve({a:1});
  }
};
