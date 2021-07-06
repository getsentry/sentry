import {browserHistory} from 'react-router';
import {Severity} from '@sentry/react';
import jQuery from 'jquery';
import Cookies from 'js-cookie';
import isUndefined from 'lodash/isUndefined';

import {openSudo, redirectToProject} from 'app/actionCreators/modal';
import {EXPERIMENTAL_SPA} from 'app/constants';
import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'app/constants/apiErrorCodes';
import {metric} from 'app/utils/analytics';
import {run} from 'app/utils/apiSentryClient';
import getCsrfToken from 'app/utils/getCsrfToken';
import {uniqueId} from 'app/utils/guid';
import createRequestError from 'app/utils/requestError/createRequestError';

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

const globalErrorHandlers: ((jqXHR: JQueryXHR) => void)[] = [];

export const initApiClientErrorHandling = () =>
  globalErrorHandlers.push((jqXHR: JQueryXHR) => {
    const pageAllowsAnon = ALLOWED_ANON_PAGES.find(regex =>
      regex.test(window.location.pathname)
    );

    // Ignore error unless it is a 401
    if (!jqXHR || jqXHR.status !== 401 || pageAllowsAnon) {
      return;
    }

    const code = jqXHR?.responseJSON?.detail?.code;
    const extra = jqXHR?.responseJSON?.detail?.extra;

    // 401s can also mean sudo is required or it's a request that is allowed to fail
    // Ignore if these are the cases
    if (
      [
        'sudo-required',
        'ignore',
        '2fa-required',
        'app-connect-authentication-error',
        'itunes-authentication-error',
        'itunes-2fa-required',
      ].includes(code)
    ) {
      return;
    }

    // If user must login via SSO, redirect to org login page
    if (code === 'sso-required') {
      window.location.assign(extra.loginUrl);
      return;
    }

    if (code === 'member-disabled-over-limit') {
      browserHistory.replace(extra.next);
    }

    // Otherwise, the user has become unauthenticated. Send them to auth
    Cookies.set('session_expired', '1');

    if (EXPERIMENTAL_SPA) {
      browserHistory.replace('/auth/login/');
    } else {
      window.location.reload();
    }
  });

/**
 * Construct a full request URL
 */
function buildRequestUrl(baseUrl: string, path: string, query: RequestOptions['query']) {
  let params: string;
  try {
    params = jQuery.param(query ?? [], true);
  } catch (err) {
    run(Sentry =>
      Sentry.withScope(scope => {
        scope.setExtra('path', path);
        scope.setExtra('query', query);
        Sentry.captureException(err);
      })
    );
    throw err;
  }

  let fullUrl: string;

  // Append the baseUrl
  if (path.indexOf(baseUrl) === -1) {
    fullUrl = baseUrl + path;
  } else {
    fullUrl = path;
  }

  if (!params) {
    return fullUrl;
  }

  // Append query parameters
  if (fullUrl.indexOf('?') !== -1) {
    fullUrl += '&' + params;
  } else {
    fullUrl += '?' + params;
  }

  return fullUrl;
}

/**
 * Check if the API response says project has been renamed.  If so, redirect
 * user to new project slug
 */
// TODO(ts): refine this type later
export function hasProjectBeenRenamed(response: JQueryXHR) {
  const code = response?.responseJSON?.detail?.code;

  // XXX(billy): This actually will never happen because we can't intercept the 302
  // jQuery ajax will follow the redirect by default...
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
  success?: (data: any, textStatus?: string, xhr?: JQueryXHR) => void;
  complete?: (jqXHR: JQueryXHR, textStatus: string) => void;
  // TODO(ts): Update this when sentry is mostly migrated to TS
  error?: FunctionCallback;
};

export type RequestOptions = RequestCallbacks & {
  /**
   * The HTTP method to use when making the API request
   */
  method?: APIRequestMethod;
  /**
   * Values to attach to the body of the request.
   */
  data?: any;
  /**
   * Query parameters to add to the requested URL.
   */
  query?: Array<any> | object;
  /**
   * Because of the async nature of API requests, errors will happen outside of
   * the stack that initated the request. a preservedError can be passed to
   * coalesce the stacks together.
   */
  preservedError?: Error;
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

      if (req && req.alive) {
        // Check if API response is a 302 -- means project slug was renamed and user
        // needs to be redirected
        // @ts-expect-error
        if (hasProjectBeenRenamed(...args)) {
          return;
        }

        if (isUndefined(func)) {
          return;
        }

        // Call success callback
        return func.apply(req, args); // eslint-disable-line
      }
    };
  }

  /**
   * Attempt to cancel all active XHR requests
   */
  clear() {
    Object.values(this.activeRequests).forEach(r => r.cancel());
  }

  handleRequestError(
    {id, path, requestOptions}: HandleRequestErrorOptions,
    response: JQueryXHR,
    textStatus: string,
    errorThrown: string
  ) {
    const code = response?.responseJSON?.detail?.code;
    const isSudoRequired = code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED;

    let didSuccessfullyRetry = false;

    if (isSudoRequired) {
      openSudo({
        superuser: code === SUPERUSER_REQUIRED,
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
    const errorCb = this.wrapCallback<[JQueryXHR, string, string]>(
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

    if (!isUndefined(data) && method !== 'GET') {
      data = JSON.stringify(data);
    }

    // TODO(epurkhiser): Mimicking the old jQuery API, data could be a string /
    // object for GET requets. jQuery just sticks it onto the URL as query
    // parameters
    if (method === 'GET' && data) {
      const queryString = typeof data === 'string' ? data : jQuery.param(data);

      if (queryString.length > 0) {
        fullUrl = fullUrl + (fullUrl.indexOf('?') !== -1 ? '&' : '?') + queryString;
      }
    }

    const id = uniqueId();
    const startMarker = `api-request-start-${id}`;

    metric.mark({name: startMarker});

    const errorObject = new Error();

    /**
     * Called when the request completes with a 2xx status
     */
    const successHandler = (responseData: any, textStatus: string, xhr: JQueryXHR) => {
      metric.measure({
        name: 'app.api.request-success',
        start: startMarker,
        data: {status: xhr?.status},
      });
      if (!isUndefined(options.success)) {
        this.wrapCallback<[any, string, JQueryXHR]>(id, options.success)(
          responseData,
          textStatus,
          xhr
        );
      }
    };

    /**
     * Called when the request is non-2xx
     */
    const errorHandler = (resp: JQueryXHR, textStatus: string, errorThrown: string) => {
      metric.measure({
        name: 'app.api.request-error',
        start: startMarker,
        data: {status: resp?.status},
      });

      if (
        resp &&
        resp.status !== 0 &&
        resp.status !== 404 &&
        errorThrown !== 'Request was aborted'
      ) {
        run(Sentry =>
          Sentry.withScope(scope => {
            // `requestPromise` can pass its error object
            const preservedError = options.preservedError ?? errorObject;

            const errorObjectToUse = createRequestError(
              resp,
              preservedError.stack,
              method,
              path
            );

            errorObjectToUse.removeFrames(3);

            // Setting this to warning because we are going to capture all failed requests
            scope.setLevel(Severity.Warning);
            scope.setTag('http.statusCode', String(resp.status));
            scope.setTag('error.reason', errorThrown);
            Sentry.captureException(errorObjectToUse);
          })
        );
      }

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
    const completeHandler = (jqXHR: JQueryXHR, textStatus: string) =>
      this.wrapCallback<[JQueryXHR, string]>(
        id,
        options.complete,
        true
      )(jqXHR, textStatus);

    // AbortController is optional, though most browser should support it.
    const aborter =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;

    // GET requests may not have a body
    const body = method !== 'GET' ? data : undefined;

    const headers = new Headers({
      Accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/json',
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
      credentials: 'same-origin',
      signal: aborter?.signal,
    });

    // XXX(epurkhiser): We're migrating off of jquery, so for now we have a
    // compatibility layer which mimics that of the jquery response objects.
    fetchRequest
      .then(async response => {
        // The Response's body can only be resolved/used at most once.
        // So we clone the response so we can resolve the body content as text content.
        // Response objects need to be cloned before its body can be used.
        const responseClone = response.clone();

        let responseJSON: any;
        let responseText: any;

        const {status, statusText} = response;
        let {ok} = response;
        let errorReason = 'Request not OK'; // the default error reason

        // Try to get text out of the response no matter the status
        try {
          responseText = await response.text();
        } catch (error) {
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
            responseJSON = await responseClone.json();
          } catch (error) {
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

        const emulatedJQueryXHR: any = {
          status,
          statusText,
          responseJSON,
          responseText,
          getResponseHeader: (header: string) => response.headers.get(header),
        };

        // Respect the response content-type header
        const responseData = isResponseJSON ? responseJSON : responseText;

        if (ok) {
          successHandler(responseData, statusText, emulatedJQueryXHR);
        } else {
          globalErrorHandlers.forEach(handler => handler(emulatedJQueryXHR));
          errorHandler(emulatedJQueryXHR, statusText, errorReason);
        }

        completeHandler(emulatedJQueryXHR, statusText);
      })
      .catch(err => {
        // Aborts are expected
        if (err?.name === 'AbortError') {
          return;
        }

        // The request failed for other reason
        run(Sentry =>
          Sentry.withScope(scope => {
            scope.setLevel(Severity.Warning);
            Sentry.captureException(err);
          })
        );
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
  ): Promise<
    IncludeAllArgsType extends true
      ? [any, string | undefined, JQueryXHR | undefined]
      : any
  > {
    // Create an error object here before we make any async calls so
    // that we have a helpful stack trace if it errors
    //
    // This *should* get logged to Sentry only if the promise rejection is not handled
    // (since SDK captures unhandled rejections). Ideally we explicitly ignore rejection
    // or handle with a user friendly error message
    const preservedError = new Error();

    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        preservedError,
        success: (data, textStatus, xhr) => {
          includeAllArgs ? resolve([data, textStatus, xhr] as any) : resolve(data);
        },
        error: (resp: JQueryXHR) => {
          const errorObjectToUse = createRequestError(
            resp,
            preservedError.stack,
            options.method,
            path
          );
          errorObjectToUse.removeFrames(2);

          // Although `this.request` logs all error responses, this error object can
          // potentially be logged by Sentry's unhandled rejection handler
          reject(errorObjectToUse);
        },
      });
    });
  }
}
