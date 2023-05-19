import {ResponseMeta} from 'sentry/api';

import {sanitizePath} from './sanitizePath';

const ERROR_MAP = {
  0: 'CancelledError',
  400: 'BadRequestError',
  401: 'UnauthorizedError',
  403: 'ForbiddenError',
  404: 'NotFoundError',
  414: 'URITooLongError',
  426: 'UpgradeRequiredError',
  429: 'TooManyRequestsError',
  500: 'InternalServerError',
  501: 'NotImplementedError',
  502: 'BadGatewayError',
  503: 'ServiceUnavailableError',
  504: 'GatewayTimeoutError',
};

interface ErrorOptionsObject {
  cause: Error;
}

// Technically, this should include the fact that `responseJSON` can be an
// array, but since we never actually use its array-ness, it makes the typing
// significantly simpler if we just rely on the "arrays are objects and we
// can always check if a given property is defined on an object" principle
type ResponseJSON = {
  [key: string]: unknown;
  detail?: string | {code?: string; message?: string};
};

export default class RequestError extends Error {
  responseText?: string;
  responseJSON?: ResponseJSON;
  status?: number;
  statusText?: string;

  constructor(method: string | undefined, path: string, options: ErrorOptionsObject) {
    super(`${method || 'GET'} "${sanitizePath(path)}"`, options);
    this.name = 'RequestError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Updates Error with XHR response
   */
  addResponseMetadata(resp: ResponseMeta) {
    if (resp) {
      this.setNameFromStatus(resp.status);

      this.message = `${this.message} ${
        typeof resp.status === 'number' ? resp.status : 'n/a'
      }`;

      // Some callback handlers expect these properties on the error object
      if (resp.responseText) {
        this.responseText = resp.responseText;
      }

      if (resp.responseJSON) {
        this.responseJSON = resp.responseJSON;
      }

      this.status = resp.status;
      this.statusText = resp.statusText;
    }
  }

  setNameFromStatus(status: number) {
    const errorName = ERROR_MAP[status];

    if (errorName) {
      this.name = errorName;
    }
  }
}
