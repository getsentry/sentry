var api = require("../api");

var ApiMixin = {
  componentWillMount() {
    this._pendingRequests = new Set();
    this._id = 0;
  },

  componentWillUnmount() {
    this._pendingRequests.forEach((req) => {
      req.cancel();
    });
  },

  apiRequest(path, options) {
    var self = this;

    var completeFunc = options.complete;
    options.complete = function(...params) {
      self._pendingRequests.delete(this);

      if (typeof completeFunc !== "undefined") {
        completeFunc.apply(this, params);
      }
    };

    var req = api.request(path, options);
    this._pendingRequests.add(req);
  }
};

module.exports = ApiMixin;
