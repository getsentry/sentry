/*** @jsx React.DOM */

var api = require('../api');
var parseLinkHeader = require('./parseLinkHeader');

class StreamPoller {
  constructor(options) {
    this.options = options;
    this._timeoutId = null;
    this._active = true;
    this._delay = 3000;
    this._pollingEndpoint = options.endpoint;
  }

  enable(){
    this._active = true;
    if (!this._timeoutId) {
      this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
    }
  }

  disable(){
    this._active = false;
    if (this._timeoutId) {
      window.clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  poll() {
    api.request(this._pollingEndpoint, {
      success: (data, _, jqXHR) => {
        // cancel in progress operation if disabled
        if (!this._active) {
          return;
        }

        // if theres no data, nothing changes
        if (!data.length) {
          return;
        }

        var links = parseLinkHeader(jqXHR.getResponseHeader('Link'));

        this._pollingEndpoint = links.previous.href;

        this.options.success(data);
      },
      complete: () => {
        if (this._active) {
          this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
        }
      }
    });
  }
}

module.exports = StreamPoller;
