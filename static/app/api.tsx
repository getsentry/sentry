import * as Sentry from '@sentry/react';
import Cookies from 'js-cookie';
import * as qs from 'query-string';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import {EXPERIMENTAL_SPA} from 'sentry/constants';
import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'sentry/constants/apiErrorCodes';
import controlsilopatterns from 'sentry/data/controlsiloUrlPatterns';
import {metric} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import getCsrfToken from 'sentry/utils/getCsrfToken';
import {uniqueId} from 'sentry/utils/guid';
import RequestError from 'sentry/utils/requestError/requestError';
import {sanitizePath} from 'sentry/utils/requestError/sanitizePath';

import ConfigStore from './stores/configStore';

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
  resp: ResponseMeta | undefined,
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
function csrfSafeMethod(method?: string): boolean {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method ?? '');
}

/**
 * Check if we a request is going to the same or similar origin.
 * similar origins are those that share an ancestor. Example `sentry.sentry.io` and `us.sentry.io`
 * are similar origins, but sentry.sentry.io and sentry.example.io are not.
 */
export function isSimilarOrigin(target: string, origin: string): boolean {
  const targetUrl = new URL(target, origin);
  const originUrl = new URL(origin);
  // If one of the domains is a child of the other.
  if (
    originUrl.hostname.endsWith(targetUrl.hostname) ||
    targetUrl.hostname.endsWith(originUrl.hostname)
  ) {
    return true;
  }
  // Check if the target and origin are on sibiling subdomains.
  const targetHost = targetUrl.hostname.split('.');
  const originHost = originUrl.hostname.split('.');

  // Remove the subdomains. If don't have at least 2 segments we aren't subdomains.
  targetHost.shift();
  originHost.shift();
  if (targetHost.length < 2 || originHost.length < 2) {
    return false;
  }
  return targetHost.join('.') === originHost.join('.');
}

// TODO: Need better way of identifying anonymous pages that don't trigger redirect
const ALLOWED_ANON_PAGES = [
  /^\/accept\//,
  /^\/share\//,
  /^\/auth\/login\//,
  /^\/join-request\//,
  /^\/unsubscribe\//,
];

/**
 * Return true if we should skip calling the normal error handler
 */
const globalErrorHandlers: ((resp: ResponseMeta, options: RequestOptions) => boolean)[] =
  [];

export const initApiClientErrorHandling = () =>
  globalErrorHandlers.push((resp: ResponseMeta, options: RequestOptions) => {
    const pageAllowsAnon = ALLOWED_ANON_PAGES.find(regex =>
      regex.test(window.location.pathname)
    );

    // Ignore error unless it is a 401
    if (!resp || resp.status !== 401 || pageAllowsAnon) {
      return false;
    }
    if (resp && options.allowAuthError && resp.status === 401) {
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
function buildRequestUrl(baseUrl: string, path: string, options: RequestOptions) {
  let params: string;
  try {
    params = qs.stringify(options.query ?? []);
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setExtra('path', path);
      scope.setExtra('query', options.query);
      Sentry.captureException(err);
    });
    throw err;
  }

  // Append the baseUrl if required
  let fullUrl = path.includes(baseUrl) ? path : baseUrl + path;

  // Apply path and domain transforms for hybrid-cloud
  fullUrl = resolveHostname(fullUrl, options.host);

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
   * Set true, if an authentication required error is allowed for
   * a request.
   */
  allowAuthError?: boolean;
  /**
   * Values to attach to the body of the request.
   */
  data?: any;
  /**
   * Headers add to the request.
   */
  headers?: Record<string, string>;
  /**
   * The host the request should be made to.
   */
  host?: string;
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
  /**
   * By default, requests will be aborted anytime api.clear() is called,
   * which is commonly used on unmounts. When skipAbort is true, the
   * request is opted out of this behavior. Useful for when you still
   * want to cache a request on unmount.
   */
  skipAbort?: boolean;
};

type ClientOptions = {
  /**
   * The base URL path to prepend to API request URIs.
   */
  baseUrl?: string;
  /**
   * Credentials policy to apply to each request
   */
  credentials?: RequestCredentials;
  /**
   * Base set of headers to apply to each request
   */
  headers?: HeadersInit;
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
  headers: HeadersInit;
  credentials?: RequestCredentials;

  static JSON_HEADERS = {
    Accept: 'application/json; charset=utf-8',
    'Content-Type': 'application/json',
  };

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api/0';
    this.headers = options.headers ?? Client.JSON_HEADERS;
    this.activeRequests = {};
    this.credentials = options.credentials ?? 'include';
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
      // @ts-ignore TS(2556): A spread argument must either have a tuple type or... Remove this comment to see the full error message
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
        sudo: code === SUDO_REQUIRED,
        isSuperuser: code === SUPERUSER_REQUIRED,
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
   * Initiate a request to the backend API.
   *
   * Consider using `requestPromise` for the async Promise version of this method.
   */
  request(path: string, options: Readonly<RequestOptions> = {}): Request {
    const method = options.method || (options.data ? 'POST' : 'GET');

    let fullUrl = buildRequestUrl(this.baseUrl, path, options);

    let data = options.data;

    if (data !== undefined && method !== 'GET' && !(data instanceof FormData)) {
      data = JSON.stringify(data);
    }

    // TODO(epurkhiser): Mimicking the old jQuery API, data could be a string /
    // object for GET requests. jQuery just sticks it onto the URL as query
    // parameters
    if (method === 'GET' && data) {
      const queryString = typeof data === 'string' ? data : qs.stringify(data);

      if (queryString.length > 0) {
        fullUrl = fullUrl + (fullUrl.includes('?') ? '&' : '?') + queryString;
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
      typeof AbortController !== 'undefined' && !options.skipAbort
        ? new AbortController()
        : undefined;

    // GET requests may not have a body
    const body = method !== 'GET' ? data : undefined;

    const requestHeaders = new Headers({...this.headers, ...options.headers});

    // Do not set the X-CSRFToken header when making a request outside of the
    // current domain. Because we use subdomains we loosely compare origins
    if (!csrfSafeMethod(method) && isSimilarOrigin(fullUrl, window.location.origin)) {
      requestHeaders.set('X-CSRFToken', getCsrfToken());
    }

    const fetchRequest = fetch(fullUrl, {
      method,
      body,
      headers: requestHeaders,
      credentials: this.credentials,
      signal: aborter?.signal,
    });

    // XXX(epurkhiser): We migrated off of jquery, so for now we have a
    // compatibility layer which mimics that of the jquery response objects.
    fetchRequest
      .then(
        async response => {
          // The Response's body can only be resolved/used at most once.
          // So we clone the response so we can resolve the body content as text content.
          // Response objects need to be cloned before its body can be used.
          let responseJSON: any;
          let responseText: any;

          const {status, statusText} = response;
          let {ok} = response;
          let errorReason = 'Request not OK'; // the default error reason
          let twoHundredErrorReason: string | undefined;

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
          const wasExpectingJson =
            requestHeaders.get('Accept') === Client.JSON_HEADERS.Accept;

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
              } else if (
                // Empty responses from POST 201 requests are valid
                responseText?.length > 0 &&
                wasExpectingJson &&
                error instanceof SyntaxError
              ) {
                // Was expecting json but was returned something else. Possibly HTML.
                // Ideally this would not be a 200, but we should reject the promise
                ok = false;
                errorReason = 'JSON parse error. Possibly returned HTML';
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
            if (status === 200 && responseText) {
              const parameterizedPath = sanitizePath(path);
              const message = '200 treated as error';

              Sentry.withScope(scope => {
                scope.setTags({endpoint: `${method} ${parameterizedPath}`, errorReason});
                scope.setExtras({
                  twoHundredErrorReason,
                  responseJSON,
                  responseText,
                  responseContentType,
                  errorReason,
                });
                // Make sure all of these errors group, so we don't produce a bunch of noise
                scope.setFingerprint([message]);

                Sentry.captureException(
                  new Error(`${message}: ${method} ${parameterizedPath}`)
                );
              });
            }

            const shouldSkipErrorHandler =
              globalErrorHandlers
                .map(handler => handler(responseMeta, options))
                .filter(Boolean).length > 0;

            if (!shouldSkipErrorHandler) {
              errorHandler(responseMeta, statusText, errorReason);
            }
          }

          completeHandler(responseMeta, statusText);
        },
        () => {
          // Ignore failed fetch calls or errors in the fetch request itself (e.g. cancelled requests)
          // Not related to errors in responses
        }
      )
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error(error);
        Sentry.captureException(error);
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

export function resolveHostname(path: string, hostname?: string): string {
  const configLinks = ConfigStore.get('links');
  const systemFeatures = ConfigStore.get('features');

  hostname = hostname ?? '';
  if (!hostname && systemFeatures.has('system:multi-region')) {
    // /_admin/ is special: since it doesn't update OrganizationStore, it's
    // commonly the case that requests will be made for data which does not
    // exist in the same region as the one in configLinks.regionUrl. Because of
    // this we want to explicitly default those requests to be proxied through
    // the control silo which can handle region resolution in exchange for a
    // bit of latency.
    const isAdmin = window.location.pathname.startsWith('/_admin/');
    const isControlSilo = detectControlSiloPath(path);
    if (!isAdmin && !isControlSilo && configLinks.regionUrl) {
      hostname = configLinks.regionUrl;
    }
    if (isControlSilo && configLinks.sentryUrl) {
      hostname = configLinks.sentryUrl;
    }
  }

  // If we're making a request to the applications' root
  // domain, we can drop the domain as webpack devserver will add one.
  // TODO(hybridcloud) This can likely be removed when sentry.types.region.Region.to_url()
  // loses the monolith mode condition.
  if (window.__SENTRY_DEV_UI && hostname === configLinks.sentryUrl) {
    hostname = '';
  }

  // When running as yarn dev-ui we can't spread requests across domains because
  // of CORS. Instead we extract the subdomain from the hostname
  // and prepend the URL with `/region/$name` so that webpack-devserver proxy
  // can route requests to the regions.
  if (hostname && window.__SENTRY_DEV_UI) {
    const domainpattern = /https?\:\/\/([^.]*)\.sentry\.io/;
    const domainmatch = hostname.match(domainpattern);
    if (domainmatch) {
      hostname = '';
      path = `/region/${domainmatch[1]}${path}`;
    }
  }
  if (hostname) {
    path = `${hostname}${path}`;
  }

  return path;
}

function detectControlSiloPath(path: string): boolean {
  // We sometimes include querystrings in paths.
  // Using URL() to avoid handrolling URL parsing
  const url = new URL(path, 'https://sentry.io');
  path = url.pathname;
  path = path.startsWith('/') ? path.substring(1) : path;
  for (const pattern of controlsilopatterns) {
    if (pattern.test(path)) {
      return true;
    }
  }
  return false;
}
