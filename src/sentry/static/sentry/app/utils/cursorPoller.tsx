import {Client, Request} from 'app/api';
import parseLinkHeader from 'app/utils/parseLinkHeader';

type Options = {
  endpoint: string;
  success: (data: any, link?: string | null) => void;
};

const BASE_DELAY = 3000;
const MAX_DELAY = 60000;

class CursorPoller {
  constructor(options: Options) {
    this.options = options;
    this.pollingEndpoint = options.endpoint;
  }

  api = new Client();
  options: Options;
  pollingEndpoint: string;
  timeoutId: number | null = null;
  lastRequest: Request | null = null;
  active: boolean = true;

  reqsWithoutData = 0;

  getDelay() {
    const delay = BASE_DELAY * (this.reqsWithoutData + 1);
    return Math.min(delay, MAX_DELAY);
  }

  setEndpoint(url: string) {
    this.pollingEndpoint = url;
  }

  enable() {
    this.active = true;
    if (!this.timeoutId) {
      this.timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
    }
  }

  disable() {
    this.active = false;
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.lastRequest) {
      this.lastRequest.cancel();
    }
  }

  poll() {
    this.lastRequest = this.api.request(this.pollingEndpoint, {
      success: (data, _, jqXHR) => {
        // cancel in progress operation if disabled
        if (!this.active) {
          return;
        }

        // if theres no data, nothing changes
        if (!data || !data.length) {
          this.reqsWithoutData += 1;
          return;
        }

        if (this.reqsWithoutData > 0) {
          this.reqsWithoutData -= 1;
        }

        const linksHeader = jqXHR?.getResponseHeader('Link') ?? null;
        const links = parseLinkHeader(linksHeader);
        this.pollingEndpoint = links.previous.href;

        this.options.success(data, linksHeader);
      },
      error: resp => {
        if (!resp) {
          return;
        }

        // If user does not have access to the endpoint, we should halt polling
        // These errors could mean:
        // * the user lost access to a project
        // * project was renamed
        // * user needs to reauth
        if (resp.status === 404 || resp.status === 403 || resp.status === 401) {
          this.disable();
        }
      },
      complete: () => {
        this.lastRequest = null;

        if (this.active) {
          this.timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
        }
      },
    });
  }
}

export default CursorPoller;
