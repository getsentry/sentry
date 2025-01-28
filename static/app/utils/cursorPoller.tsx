import type {Request} from 'sentry/api';
import {Client} from 'sentry/api';
import {defined} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';

type Options = {
  linkPreviousHref: string;
  success: (data: any, headers: {queryCount: number}) => void;
};

const BASE_DELAY = 3000;
const MAX_DELAY = 60000;

class CursorPoller {
  constructor(options: Options) {
    this.options = options;
    this.setEndpoint(options.linkPreviousHref);
  }

  api = new Client();
  options: Options;
  pollingEndpoint: string = '';
  timeoutId: number | null = null;
  lastRequest: Request | null = null;
  active: boolean = true;

  reqsWithoutData = 0;

  getDelay() {
    const delay = BASE_DELAY * (this.reqsWithoutData + 1);
    return Math.min(delay, MAX_DELAY);
  }

  setEndpoint(linkPreviousHref: string) {
    if (!linkPreviousHref) {
      this.pollingEndpoint = '';
      return;
    }

    const issueEndpoint = new URL(linkPreviousHref, window.location.origin);

    // Remove collapse stats
    issueEndpoint.searchParams.delete('collapse');

    this.pollingEndpoint = decodeURIComponent(
      issueEndpoint.pathname + issueEndpoint.search
    );
  }

  enable() {
    this.active = true;

    // Proactively clear timeout and last request
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
    }
    if (this.lastRequest) {
      this.lastRequest.cancel();
    }
    this.timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
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
      success: (data, _, resp) => {
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

        const linksHeader = resp?.getResponseHeader('Link') ?? null;
        const hitsHeader = resp?.getResponseHeader('X-Hits') ?? null;
        const queryCount = defined(hitsHeader) ? parseInt(hitsHeader, 10) || 0 : 0;
        const links = parseLinkHeader(linksHeader);
        this.setEndpoint(links.previous!.href);

        this.options.success(data, {queryCount});
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
