import type {ResponseMeta} from 'sentry/api';

import {sanitizePath} from './sanitizePath';

export const ERROR_MAP = {
  0: 'CancelledError',
  200: 'UndefinedResponseBodyError',
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

  constructor(
    method: 'POST' | 'GET' | 'DELETE' | 'PUT' | undefined,
    path: string,
    cause: Error,
    responseMetadata?: ResponseMeta
  ) {
    const options = cause instanceof Error ? {cause} : {};
    super(`${method || 'GET'} ${sanitizePath(path)}`, options);
    // TODO (kmclb) This is here to compensate for a bug in the SDK wherein it
    // ignores subclassing of `Error` when getting error type. Once that's
    // fixed, this can go. See https://github.com/getsentry/sentry-javascript/pull/8161.
    this.name = 'RequestError';
    this.addResponseMetadata(responseMetadata);
  }

  /**
   * Updates Error with XHR response
   */
  addResponseMetadata(resp: ResponseMeta | undefined) {
    if (resp) {
      // We filter 200's out unless they're the specific case of an undefined
      // body. For the ones which will eventually get filtered, we don't care
      // about the data added here and we don't want to change the name (or it
      // won't match the filter) so bail before any of that happens.
      //
      // TODO: If it turns out the undefined ones aren't really a problem, we
      // can remove this and the `200` entry in `ERROR_MAP` above
      if (resp.status === 200 && resp.responseText !== undefined) {
        return;
      }

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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const errorName = ERROR_MAP[status];

    if (errorName) {
      this.name = errorName;
    }
  }
}
