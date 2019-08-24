import RequestError from './requestError';

const ERROR_MAP = {
  0: 'CancelledError',
  400: 'BadRequestError',
  401: 'UnauthorizedError',
  403: 'ForbiddenError',
  404: 'NotFoundError',
  426: 'UpgradeRequiredError',
  429: 'TooManyRequestsError',
  500: 'InternalServerError',
  501: 'NotImplementedError',
  502: 'BadGatewayError',
  503: 'ServiceUnavailableError',
  504: 'GatewayTimeoutError',
};

/**
 * Create a RequestError whose name is equal to HTTP status text defined above
 *
 * @param {Object} resp A XHR response object
 * @param {String} stack The stacktrace to use. Helpful for async calls and we want to preserve a different stack.
 */
export default function createRequestError(
  resp: JQueryXHR,
  stack: string | undefined,
  method: 'POST' | 'GET' | 'DELETE' | 'PUT' | undefined,
  path: string
) {
  const err = new RequestError(method, path);

  if (resp) {
    const errorName = ERROR_MAP[resp.status];

    if (errorName) {
      err.setName(errorName);
    }

    err.setResponse(resp);
  }

  if (stack) {
    err.setStack(stack);
  }

  return err;
}
