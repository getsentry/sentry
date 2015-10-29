import api from "../api";

let ApiMixin = {
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
    let self = this;

    let completeFunc = options.complete;
    options.complete = function(...params) {
      self._pendingRequests.delete(this);

      if (typeof completeFunc !== "undefined") {
        completeFunc.apply(this, params);
      }
    };

    let req = api.request(path, options);
    this._pendingRequests.add(req);
  }
};

export default ApiMixin;

