import {ResponseMeta} from 'sentry/api';

import RequestError from './requestError';

/**
 * Create a RequestError whose name is equal to HTTP status text defined above
 *
 * @param {Object} resp A XHR response object
 * @param {String} stack The stack trace to use. Helpful for async calls and we want to preserve a different stack.
 */
export default function createRequestError(
  resp: ResponseMeta,
  cause: Error,
  method: 'POST' | 'GET' | 'DELETE' | 'PUT' | undefined,
  path: string
) {
  const err = new RequestError(method, path, {cause});

  err.addResponseMetadata(resp);

  return err;
}
