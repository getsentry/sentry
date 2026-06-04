var makeAFailure = (function() {
  function onSuccess(data) {}

  function onFailure(data) {
    throw new Error('failed!');
  }

  function invoke(data) {
    var cb = null;
    if (data.failed) {
      cb = onFailure;
    } else {
      cb = onSuccess;
    }
    cb(data);
  }

  function test() {
    var data = {failed: true, value: 42};
    invoke(data);
  }

  return test;
})();
