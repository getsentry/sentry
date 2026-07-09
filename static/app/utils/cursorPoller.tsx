import {Client} from 'sentry/api';
import {defined} from 'sentry/utils/defined';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {RequestError} from 'sentry/utils/requestError/requestError';

type Options = {
  linkPreviousHref: string;
  success: (data: any, headers: {queryCount: number}) => void;
};

const BASE_DELAY = 3000;
const MAX_DELAY = 60000;

export class CursorPoller {
  constructor(options: Options) {
    this.options = options;
    this.setEndpoint(options.linkPreviousHref);
  }

  api = new Client();
  options: Options;
  pollingEndpoint = '';
  timeoutId: number | null = null;
  active = true;

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
    // Proactively cleanup to prevent multiple setTimeout per class instance
    this.disable();

    this.active = true;
    this.timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
  }

  disable() {
    this.active = false;
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Abort any in-flight poll request
    this.api.clear();
  }

  async poll() {
    try {
      const [data, , resp] = await this.api.requestPromise(this.pollingEndpoint, {
        includeAllArgs: true,
      });

      // cancel in progress operation if disabled
      if (!this.active) {
        return;
      }

      // if theres no data, nothing changes
      if (!data?.length) {
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
    } catch (error) {
      // If user does not have access to the endpoint, we should halt polling
      // These errors could mean:
      // * the user lost access to a project
      // * project was renamed
      // * user needs to reauth
      if (
        error instanceof RequestError &&
        (error.status === 404 || error.status === 403 || error.status === 401)
      ) {
        this.disable();
      }
    } finally {
      if (this.active) {
        this.timeoutId = window.setTimeout(this.poll.bind(this), this.getDelay());
      }
    }
  }
}
