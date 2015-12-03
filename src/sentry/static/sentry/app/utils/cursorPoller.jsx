import {Client} from '../api';
import parseLinkHeader from './parseLinkHeader';

class CursorPoller {
  constructor(options) {
    this.api = new Client();
    this.options = options;
    this._timeoutId = null;
    this._active = true;
    this._baseDelay = 3000;
    this._maxDelay = 60000;
    this._reqsWithoutData = 0;
    this._pollingEndpoint = options.endpoint;
  }

  getDelay() {
    let delay = this._baseDelay * (this._reqsWithoutData + 1);
    return Math.min(delay, this._maxDelay);
  }

  setEndpoint(url) {
    this._pollingEndpoint = url;
  }

  enable() {
    this._active = true;
    if (!this._timeoutId) {
      this._timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
    }
  }

  disable() {
    this._active = false;
    if (this._timeoutId) {
      window.clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    if (this._lastRequest) {
      this._lastRequest.cancel();
    }
  }

  poll() {
    this._lastRequest = this.api.request(this._pollingEndpoint, {
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

        let links = parseLinkHeader(jqXHR.getResponseHeader('Link'));
        this._pollingEndpoint = links.previous.href;

        this.options.success(data, jqXHR.getResponseHeader('Link'));
      },
      complete: () => {
        this._lastRequest = null;

        if (this._active) {
          this._timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
        }
      }
    });
  }
}

export default CursorPoller;

