/*** @jsx React.DOM */

var api = require('../api');
var parseLinkHeader = require('./parseLinkHeader');

class CursorPoller {
  constructor(options) {
    this.options = options;
    this._timeoutId = null;
    this._active = true;
    this._baseDelay = 3000;
    this._maxDelay = 60000;
    this._reqsWithoutData = 0;
    this._pollingEndpoint = options.endpoint;
  }

  getDelay() {
    var delay = this._baseDelay * (this._reqsWithoutData + 1);
    return Math.min(delay, this._maxDelay);
  }

  enable(){
    this._active = true;
    if (!this._timeoutId) {
      this._timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
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
          this._reqsWithoutData += 1;
          return;
        }

        if (this._reqsWithoutData > 0) {
          this._reqsWithoutData -= 1;
        }

        var links = parseLinkHeader(jqXHR.getResponseHeader('Link'));

        this._pollingEndpoint = links.previous.href;

        this.options.success(data, jqXHR.getResponseHeader('Link'));
      },
      complete: () => {
        if (this._active) {
          this._timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
        }
      }
    });
  }
}

module.exports = CursorPoller;
