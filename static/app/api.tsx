import {browserHistory} from 'react-router';
import * as Sentry from '@sentry/react';
import Cookies from 'js-cookie';
import * as qs from 'query-string';

import {openSudo, redirectToProject} from 'sentry/actionCreators/modal';
import {EXPERIMENTAL_SPA} from 'sentry/constants';
import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'sentry/constants/apiErrorCodes';
import {metric} from 'sentry/utils/analytics';
import getCsrfToken from 'sentry/utils/getCsrfToken';
import {uniqueId} from 'sentry/utils/guid';
import RequestError from 'sentry/utils/requestError/requestError';

export class Request {
  /**
   * Is the request still in flight
   */
  alive: boolean;
  /**
   * Promise which will be resolved when the request has completed
   */
  requestPromise: Promise<Response>;
  /**
   * AbortController to cancel the in-flight request. This will not be set in
   * unsupported browsers.
   */
  aborter?: AbortController;

  constructor(requestPromise: Promise<Response>, aborter?: AbortController) {
    this.requestPromise = requestPromise;
    this.aborter = aborter;
    this.alive = true;
  }

  cancel() {
    this.alive = false;
    this.aborter?.abort();
    metric('app.api.request-abort', 1);
  }
}

export type ApiResult<Data = any> = [
  data: Data,
  statusText: string | undefined,
  resp: ResponseMeta | undefined
];

export type ResponseMeta<R = any> = {
  /**
   * Get a header value from the response
   */
  getResponseHeader: (header: string) => string | null;
  /**
   * The response body decoded from json
   */
  responseJSON: R;
  /**
   * The string value of the response
   */
  responseText: string;
  /**
   * The response status code
   */
  status: Response['status'];
  /**
   * The response status code text
   */
  statusText: Response['statusText'];
};

/**
 * Check if the requested method does not require CSRF tokens
 */
function csrfSafeMethod(method?: string) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method ?? '');
}

// TODO: Need better way of identifying anonymous pages that don't trigger redirect
const ALLOWED_ANON_PAGES = [
  /^\/accept\//,
  /^\/share\//,
  /^\/auth\/login\//,
  /^\/join-request\//,
];

/**
 * Return true if we should skip calling the normal error handler
 */
const globalErrorHandlers: ((resp: ResponseMeta) => boolean)[] = [];

export const initApiClientErrorHandling = () =>
  globalErrorHandlers.push((resp: ResponseMeta) => {
    const pageAllowsAnon = ALLOWED_ANON_PAGES.find(regex =>
      regex.test(window.location.pathname)
    );

    // Ignore error unless it is a 401
    if (!resp || resp.status !== 401 || pageAllowsAnon) {
      return false;
    }

    const code = resp?.responseJSON?.detail?.code;
    const extra = resp?.responseJSON?.detail?.extra;

    // 401s can also mean sudo is required or it's a request that is allowed to fail
    // Ignore if these are the cases
    if (
      [
        'sudo-required',
        'ignore',
        '2fa-required',
        'app-connect-authentication-error',
      ].includes(code)
    ) {
      return false;
    }

    // If user must login via SSO, redirect to org login page
    if (code === 'sso-required') {
      window.location.assign(extra.loginUrl);
      return true;
    }

    if (code === 'member-disabled-over-limit') {
      browserHistory.replace(extra.next);
      return true;
    }

    // Otherwise, the user has become unauthenticated. Send them to auth
    Cookies.set('session_expired', '1');

    if (EXPERIMENTAL_SPA) {
      browserHistory.replace('/auth/login/');
    } else {
      window.location.reload();
    }
    return true;
  });

/**
 * Construct a full request URL
 */
function buildRequestUrl(baseUrl: string, path: string, query: RequestOptions['query']) {
  let params: string;
  try {
    params = qs.stringify(query ?? []);
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setExtra('path', path);
      scope.setExtra('query', query);
      Sentry.captureException(err);
    });
    throw err;
  }

  // Append the baseUrl
  let fullUrl = path.includes(baseUrl) ? path : baseUrl + path;

  // Append query parameters
  if (params) {
    fullUrl += fullUrl.includes('?') ? `&${params}` : `?${params}`;
  }

  return fullUrl;
}

/**
 * Check if the API response says project has been renamed.  If so, redirect
 * user to new project slug
 */
// TODO(ts): refine this type later
export function hasProjectBeenRenamed(response: ResponseMeta) {
  const code = response?.responseJSON?.detail?.code;

  // XXX(billy): This actually will never happen because we can't intercept the 302
  // jQuery ajax will follow the redirect by default...
  //
  // TODO(epurkhiser): We use fetch now, is the above comment still true?
  if (code !== PROJECT_MOVED) {
    return false;
  }

  const slug = response?.responseJSON?.detail?.extra?.slug;

  redirectToProject(slug);
  return true;
}

// TODO(ts): move this somewhere
export type APIRequestMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

type FunctionCallback<Args extends any[] = any[]> = (...args: Args) => void;

export type RequestCallbacks = {
  /**
   * Callback for the request completing (success or error)
   */
  complete?: (resp: ResponseMeta, textStatus: string) => void;
  /**
   * Callback for the request failing with an error
   */
  // TODO(ts): Update this when sentry is mostly migrated to TS
  error?: FunctionCallback;
  /**
   * Callback for the request completing successfully
   */
  success?: (data: any, textStatus?: string, resp?: ResponseMeta) => void;
};

export type RequestOptions = RequestCallbacks & {
  /**
   * Values to attach to the body of the request.
   */
  data?: any;
  /**
   * Headers add to the request.
   */
  headers?: Record<string, string>;
  /**
   * The HTTP method to use when making the API request
   */
  method?: APIRequestMethod;
  /**
   * Because of the async nature of API requests, errors will happen outside of
   * the stack that initated the request. a preservedError can be passed to
   * coalesce the stacks together.
   */
  preservedError?: Error;
  /**
   * Query parameters to add to the requested URL.
   */
  query?: Record<string, any>;
};

type ClientOptions = {
  /**
   * The base URL path to prepend to API request URIs.
   */
  baseUrl?: string;
};

type HandleRequestErrorOptions = {
  id: string;
  path: string;
  requestOptions: Readonly<RequestOptions>;
};

/**
 * The API client is used to make HTTP requests to Sentry's backend.
 *
 * This is they preferred way to talk to the backend.
 */
export class Client {
  baseUrl: string;
  activeRequests: Record<string, Request>;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api/0';
    this.activeRequests = {};
  }

  wrapCallback<T extends any[]>(
    id: string,
    func: FunctionCallback<T> | undefined,
    cleanup: boolean = false
  ) {
    return (...args: T) => {
      const req = this.activeRequests[id];

      if (cleanup === true) {
        delete this.activeRequests[id];
      }

      if (!req?.alive) {
        return undefined;
      }

      // Check if API response is a 302 -- means project slug was renamed and user
      // needs to be redirected
      // @ts-expect-error
      if (hasProjectBeenRenamed(...args)) {
        return undefined;
      }

      // Call success callback
      return func?.apply(req, args);
    };
  }

  /**
   * Attempt to cancel all active fetch requests
   */
  clear() {
    Object.values(this.activeRequests).forEach(r => r.cancel());
  }

  handleRequestError(
    {id, path, requestOptions}: HandleRequestErrorOptions,
    response: ResponseMeta,
    textStatus: string,
    errorThrown: string
  ) {
    const code = response?.responseJSON?.detail?.code;
    const isSudoRequired = code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED;

    let didSuccessfullyRetry = false;

    if (isSudoRequired) {
      openSudo({
        isSuperuser: code === SUPERUSER_REQUIRED,
        sudo: code === SUDO_REQUIRED,
        retryRequest: async () => {
          try {
            const data = await this.requestPromise(path, requestOptions);
            requestOptions.success?.(data);
            didSuccessfullyRetry = true;
          } catch (err) {
            requestOptions.error?.(err);
          }
        },
        onClose: () =>
          // If modal was closed, then forward the original response
          !didSuccessfullyRetry && requestOptions.error?.(response),
      });
      return;
    }

    // Call normal error callback
    const errorCb = this.wrapCallback<[ResponseMeta, string, string]>(
      id,
      requestOptions.error
    );
    errorCb?.(response, textStatus, errorThrown);
  }

  /**
   * Initate a request to the backend API.
   *
   * Consider using `requestPromise` for the async Promise version of this method.
   */
  request(path: string, options: Readonly<RequestOptions> = {}): Request {
    const method = options.method || (options.data ? 'POST' : 'GET');

    let fullUrl = buildRequestUrl(this.baseUrl, path, options.query);

    let data = options.data;

    if (data !== undefined && method !== 'GET') {
      data = JSON.stringify(data);
    }

    // TODO(epurkhiser): Mimicking the old jQuery API, data could be a string /
    // object for GET requets. jQuery just sticks it onto the URL as query
    // parameters
    if (method === 'GET' && data) {
      const queryString = typeof data === 'string' ? data : qs.stringify(data);

      if (queryString.length > 0) {
        fullUrl = fullUrl + (fullUrl.indexOf('?') !== -1 ? '&' : '?') + queryString;
      }
    }

    const id = uniqueId();
    const startMarker = `api-request-start-${id}`;

    metric.mark({name: startMarker});

    /**
     * Called when the request completes with a 2xx status
     */
    const successHandler = (
      resp: ResponseMeta,
      textStatus: string,
      responseData: any
    ) => {
      metric.measure({
        name: 'app.api.request-success',
        start: startMarker,
        data: {status: resp?.status},
      });
      if (options.success !== undefined) {
        this.wrapCallback<[any, string, ResponseMeta]>(id, options.success)(
          responseData,
          textStatus,
          resp
        );
      }
    };

    /**
     * Called when the request is non-2xx
     */
    const errorHandler = (
      resp: ResponseMeta,
      textStatus: string,
      errorThrown: string
    ) => {
      metric.measure({
        name: 'app.api.request-error',
        start: startMarker,
        data: {status: resp?.status},
      });

      this.handleRequestError(
        {id, path, requestOptions: options},
        resp,
        textStatus,
        errorThrown
      );
    };

    /**
     * Called when the request completes
     */
    const completeHandler = (resp: ResponseMeta, textStatus: string) =>
      this.wrapCallback<[ResponseMeta, string]>(
        id,
        options.complete,
        true
      )(resp, textStatus);

    // AbortController is optional, though most browser should support it.
    const aborter =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;

    // GET requests may not have a body
    const body = method !== 'GET' ? data : undefined;

    const headers = new Headers({
      Accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/json',
      ...options.headers,
    });

    // Do not set the X-CSRFToken header when making a request outside of the
    // current domain
    const absoluteUrl = new URL(fullUrl, window.location.origin);
    const isSameOrigin = window.location.origin === absoluteUrl.origin;

    if (!csrfSafeMethod(method) && isSameOrigin) {
      headers.set('X-CSRFToken', getCsrfToken());
    }

    const fetchRequest = fetch(fullUrl, {
      method,
      body,
      headers,
      credentials: 'include',
      signal: aborter?.signal,
    });

    // XXX(epurkhiser): We migrated off of jquery, so for now we have a
    // compatibility layer which mimics that of the jquery response objects.
    fetchRequest
      .then(async response => {
        // The Response's body can only be resolved/used at most once.
        // So we clone the response so we can resolve the body content as text content.
        // Response objects need to be cloned before its body can be used.
        let responseJSON: any;
        let responseText: any;

        const {status, statusText} = response;
        let {ok} = response;
        let errorReason = 'Request not OK'; // the default error reason
        let twoHundredErrorReason;

        // Try to get text out of the response no matter the status
        try {
          responseText = await response.text();
        } catch (error) {
          twoHundredErrorReason = 'Failed awaiting response.text()';
          ok = false;
          if (error.name === 'AbortError') {
            errorReason = 'Request was aborted';
          } else {
            errorReason = error.toString();
          }
        }

        const responseContentType = response.headers.get('content-type');
        const isResponseJSON = responseContentType?.includes('json');

        const isStatus3XX = status >= 300 && status < 400;
        if (status !== 204 && !isStatus3XX) {
          try {
            responseJSON = JSON.parse(responseText);
          } catch (error) {
            twoHundredErrorReason = 'Failed trying to parse responseText';
            if (error.name === 'AbortError') {
              ok = false;
              errorReason = 'Request was aborted';
            } else if (isResponseJSON && error instanceof SyntaxError) {
              // If the MIME type is `application/json` but decoding failed,
              // this should be an error.
              ok = false;
              errorReason = 'JSON parse error';
            }
          }
        }

        const responseMeta: ResponseMeta = {
          status,
          statusText,
          responseJSON,
          responseText,
          getResponseHeader: (header: string) => response.headers.get(header),
        };

        // Respect the response content-type header
        const responseData = isResponseJSON ? responseJSON : responseText;

        if (ok) {
          successHandler(responseMeta, statusText, responseData);
        } else {
          // There's no reason we should be here with a 200 response, but we get
          // tons of events from this codepath with a 200 status nonetheless.
          // Until we know why, let's do what is essentially some very fancy print debugging.
          if (status === 200) {
            const responseTextUndefined = responseText === undefined;

            // Pass a scope object rather than using `withScope` to avoid even
            // the possibility of scope bleed.
            const scope = new Sentry.Scope();
            scope.setTags({errorReason});

            if (!responseTextUndefined) {
              // Grab everything that could conceivably be helpful to know
              scope.setExtras({
                twoHundredErrorReason,
                responseJSON,
                // Force `undefined` and the empty string to print so they're differentiable in the UI
                responseText: String(responseText) || '[empty string]',
                responseContentType,
                errorReason,
              });
            }

            const message = responseTextUndefined
              ? '200 API response with undefined responseText'
              : '200 treated as error';

            // Make sure all of these errors group, so we don't produce a bunch of noise
            scope.setFingerprint([message]);

            Sentry.captureException(new Error(`${message}: ${method} ${path}`), scope);
          }

          const shouldSkipErrorHandler =
            globalErrorHandlers.map(handler => handler(responseMeta)).filter(Boolean)
              .length > 0;

          if (!shouldSkipErrorHandler) {
            errorHandler(responseMeta, statusText, errorReason);
          }
        }

        completeHandler(responseMeta, statusText);
      })
      .catch(() => {
        // Ignore all failed requests
      });

    const request = new Request(fetchRequest, aborter);
    this.activeRequests[id] = request;

    return request;
  }

  requestPromise<IncludeAllArgsType extends boolean>(
    path: string,
    {
      includeAllArgs,
      ...options
    }: {includeAllArgs?: IncludeAllArgsType} & Readonly<RequestOptions> = {}
  ): Promise<IncludeAllArgsType extends true ? ApiResult : any> {
    // Create an error object here before we make any async calls so that we
    // have a helpful stack trace if it errors
    //
    // This *should* get logged to Sentry only if the promise rejection is not handled
    // (since SDK captures unhandled rejections). Ideally we explicitly ignore rejection
    // or handle with a user friendly error message
    const preservedError = new Error('API Request Error');

    return new Promise((resolve, reject) =>
      this.request(path, {
        ...options,
        preservedError,
        success: (data, textStatus, resp) => {
          if (includeAllArgs) {
            resolve([data, textStatus, resp] as any);
          } else {
            resolve(data);
          }
        },
        error: (resp: ResponseMeta) => {
          const errorObjectToUse = new RequestError(
            options.method,
            path,
            preservedError,
            resp
          );

          // Although `this.request` logs all error responses, this error object can
          // potentially be logged by Sentry's unhandled rejection handler
          reject(errorObjectToUse);
        },
      })
    );
  }
}
