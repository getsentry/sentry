import {Client} from '../api';
import parseLinkHeader from './parseLinkHeader';

class CursorPoller {
  constructor(options) {
    this.api = new Client();
    this.options = options;
    this._timeoutId = null;
    this._active = true;
    this._delay = 3000;
    this._pollingEndpoint = options.endpoint;
  }

  setEndpoint(url) {
    this._pollingEndpoint = url;
  }

  enable() {
    this._active = true;
    if (!this._timeoutId) {
      this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
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

        this.options.success(data, jqXHR.getResponseHeader('Link'));
      },
      complete: () => {
        this._lastRequest = null;

        if (this._active) {
          this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
        }
      }
    });
  }
}

export default CursorPoller;
