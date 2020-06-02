const makeAFailure = (function() {
  function onSuccess(data) {}

  function onFailure(data) {
    throw new Error('failed!');
  }

  function invoke(data) {
    let cb = null;
    if (data.failed) {
      cb = onFailure;
    } else {
      cb = onSuccess;
    }
    cb(data);
  }

  function test() {
    const data = {failed: true, value: 42};
    invoke(data);
  }

  return test;
})();
