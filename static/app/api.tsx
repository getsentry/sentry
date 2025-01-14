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

/**
 * Check if the requested method does not require CSRF tokens
 */
function isCSRFSafeMethod(method?: string): boolean {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method ?? '');
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

export type ApiResult<Data = any> = [
  data: Data,
  statusText: string | undefined,
  resp: ResponseMeta | undefined,
];

export type ResponseMeta = {
  /**
   * Get a header value from the response
   */
  getResponseHeader: (header: string) => string | null;
  /**
   * The response body decoded from json
   */
  responseJSON: Record<string, any> | undefined;
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

export type APIRequestMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type RequestCallbackOptions = {
  /**
   * Callback for the request completing (success or error)
   */
  complete?: (responseMeta: ResponseMeta, statusText: string) => void;
  /**
   * Callback for the request failing with an error
   */
  error?: (response: ResponseMeta, statusText: string, errorThrown: string) => void;
  /**
   * Callback for the request completing successfully
   */
  success?: (responseData: any, statusText: string, responseMeta: ResponseMeta) => void;
};

export interface RequestOptions extends RequestCallbackOptions {
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
}

export class Request {
  /**
   * The unique identifier for the request
   */
  id: string;
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
    this.id = uniqueId();

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

export type ClientOptions = {
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

/**
 * The API client is used to make HTTP requests to Sentry's backend.
 *
 * This is they preferred way to talk to the backend.
 */
export class Client {
  public baseUrl: string;
  public activeRequests: Record<string, Request>;
  public headers: HeadersInit;
  public credentials?: RequestCredentials;

  static readonly JSON_HEADERS = {
    Accept: 'application/json; charset=utf-8',
    'Content-Type': 'application/json',
  };

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api/0';
    this.headers = options.headers ?? Client.JSON_HEADERS;
    this.credentials = options.credentials ?? 'include';
    this.activeRequests = {};
  }

  /**
   * Check if we a request is going to the same or similar origin.
   * similar origins are those that share an ancestor. Example `sentry.sentry.io` and `us.sentry.io`
   * are similar origins, but sentry.sentry.io and sentry.example.io are not.
   */
  public static isSimilarOrigin(target: string, origin: string): boolean {
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

  /**
   * Construct a full request URL and ensures that the data for GET requests is stringified.
   * Warning: This function mutates the options object to clear the data for GET requests.
   */
  public static makeRequestUrl(
    baseUrl: string,
    path: string,
    options: RequestOptions
  ): [string, any] {
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

    if (
      options.data !== undefined &&
      options.method !== 'GET' &&
      !(options.data instanceof FormData)
    ) {
      options.data = JSON.stringify(options.data);
    }

    // TODO(epurkhiser): Mimicking the old jQuery API, data could be a string /
    // object for GET requests. jQuery just sticks it onto the URL as query
    // parameters
    if (options.method === 'GET' && options.data) {
      const queryString =
        typeof options.data === 'string' ? options.data : qs.stringify(options.data);

      if (queryString.length > 0) {
        fullUrl = fullUrl + (fullUrl.includes('?') ? '&' : '?') + queryString;
      }

      // The data is being sent as query parameters, so we don't need to send it in the body.
      options.data = undefined;
    }

    return [fullUrl, options.data];
  }

  public static makeRequestHeaders(
    url: string,
    headers: HeadersInit,
    options: RequestOptions
  ): Headers {
    const requestHeaders = new Headers({...headers, ...options.headers});

    // Do not set the X-CSRFToken header when making a request outside of the
    // current domain. Because we use subdomains we loosely compare origins
    if (
      !isCSRFSafeMethod(options.method) &&
      Client.isSimilarOrigin(url, window.location.origin)
    ) {
      requestHeaders.set('X-CSRFToken', getCsrfToken());
    }

    return requestHeaders;
  }

  // Check if API response is a 302 -- means project slug was renamed and user needs to be redirected
  // Handle API 302 response for project renames. This code exists, but is in practice
  // never called as we never set redirect: 'manual' on the fetch request.
  static projectMovedMiddleware(request: Request, response: ResponseMeta) {
    if (request.alive && response?.responseJSON?.detail?.code === PROJECT_MOVED) {
      redirectToProject(response?.responseJSON?.detail?.extra?.slug);
    }

    return;
  }

  // @TODO(jonasbadalic): add comments explaining what this does
  static async bodyParserMiddleware(
    requestHeaders: Headers,
    response: Response
  ): Promise<{
    errorReason: string;
    isResponseJSON: boolean;
    ok: boolean;
    response: Response;
    responseJSON: ResponseMeta['responseJSON'];
    responseText: ResponseMeta['responseText'];
    status: ResponseMeta['status'];
    statusText: ResponseMeta['statusText'];
    twoHundredErrorReason: string | undefined;
  }> {
    let {ok} = response;
    const {status, statusText} = response;

    let errorReason = 'Request not OK'; // the default error reason
    let twoHundredErrorReason: string | undefined;

    // The Response's body can only be resolved/used at most once.
    // So we clone the response so we can resolve the body content as text content.
    // Response objects need to be cloned before its body can be used.
    let responseJSON: any;
    let responseText: any;

    // Attempt to extract text out of the response, no matter the status
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

    const isResponseJSON =
      response.headers.get('content-type')?.includes('json') ?? false;
    const requestIsExpectingJSON =
      requestHeaders.get('Accept') === Client.JSON_HEADERS.Accept;

    if (status !== 204 && !(status >= 300 && status < 400)) {
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
          requestIsExpectingJSON &&
          error instanceof SyntaxError
        ) {
          // Was expecting json but was returned something else. Possibly HTML.
          // Ideally this would not be a 200, but we should reject the promise
          ok = false;
          errorReason = 'JSON parse error. Possibly returned HTML';
        }
      }
    }

    return {
      status,
      statusText,
      isResponseJSON,
      response,
      responseJSON,
      responseText,
      twoHundredErrorReason,
      errorReason,
      ok,
    };
  }

  /**
   * Initiate a request to the backend API.
   *
   * Consider using `requestPromise` for the async Promise version of this method.
   */
  request(path: string, options: Readonly<RequestOptions> = {}): Request {
    const method = options.method || (options.data ? 'POST' : 'GET');

    const [url, data] = Client.makeRequestUrl(this.baseUrl, path, options);
    const requestHeaders = Client.makeRequestHeaders(url, this.headers, options);

    // Feature detect AbortController
    const abortController =
      typeof AbortController !== 'undefined' && !options.skipAbort
        ? new AbortController()
        : undefined;

    const fetchRequest = fetch(url, {
      method,
      body: data,
      headers: requestHeaders,
      credentials: this.credentials,
      signal: abortController?.signal,
    });

    const request = new Request(fetchRequest, abortController);
    this.activeRequests[request.id] = request;

    const startMarker = `api-request-start-${request.id}`;
    metric.mark({name: startMarker});

    fetchRequest
      .then(response => {
        // The body parser middleware needs the request headers to be able to
        // determine if the request was expecting JSON or not.
        return Client.bodyParserMiddleware(requestHeaders, response);
      })
      .then(
        body => {
          const responseMeta: ResponseMeta = {
            status: body.status,
            statusText: body.statusText,
            responseJSON: body.responseJSON,
            responseText: body.responseText,
            getResponseHeader: (header: string) => body.response.headers.get(header),
          };

          if (body.ok) {
            metric.measure({
              name: 'app.api.request-success',
              start: startMarker,
              data: {status: responseMeta?.status},
            });
            if (options.success !== undefined) {
              options.success(
                // Respect the response content-type header
                body.isResponseJSON ? body.responseJSON : body.responseText,
                body.statusText,
                responseMeta
              );
            }
          }
          // There's no reason we should be here with a 200 response, but we get
          // tons of events from this codepath with a 200 status nonetheless.
          // Until we know why, let's do what is essentially some very fancy print debugging.
          if (body.status === 200 && body.responseText) {
            const parameterizedPath = sanitizePath(path);
            const message = '200 treated as error';

            Sentry.withScope(scope => {
              scope.setTags({
                endpoint: `${method} ${parameterizedPath}`,
                errorReason: body.errorReason,
              });
              scope.setExtras({
                twoHundredErrorReason: body.twoHundredErrorReason,
                responseJSON: body.responseJSON,
                responseText: body.responseText,
                responseContentType: body.response.headers.get('content-type'),
                errorReason: body.errorReason,
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
            metric.measure({
              name: 'app.api.request-error',
              start: startMarker,
              data: {status: responseMeta?.status},
            });

            this.handleRequestError(
              {id: request.id, path, requestOptions: options},
              responseMeta,
              body.statusText,
              body.errorReason
            );
          }

          if (options.complete) {
            options.complete(responseMeta, body.statusText);
          }
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
      })
      .finally(() => {
        delete this.activeRequests[request.id];
      });

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

    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        preservedError,
        error: (resp: ResponseMeta) => {
          // Although `this.request` logs all error responses, this error object can
          // potentially be logged by Sentry's unhandled rejection handler
          reject(new RequestError(options.method, path, preservedError, resp));
        },
        success: (data: any, textStatus?: string, resp?: ResponseMeta) => {
          if (includeAllArgs) {
            resolve([data, textStatus, resp] as any);
          } else {
            resolve(data);
          }
        },
      });
    });
  }

  handleRequestError(
    options: {
      id: string;
      path: string;
      requestOptions: Readonly<RequestOptions>;
    },
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
            const data = await this.requestPromise(options.path, options.requestOptions);
            if (options.requestOptions.success) {
              options.requestOptions.success(data, textStatus, response);
            }
            didSuccessfullyRetry = true;
          } catch (err) {
            options.requestOptions.error?.(response, textStatus, err);
          }
        },
        onClose: () => {
          if (didSuccessfullyRetry) {
            return;
          }

          if (options.requestOptions.error) {
            options.requestOptions.error(response, textStatus, errorThrown);
          }
        },
      });
      return;
    }

    // Call normal error callback
    if (options.requestOptions.error) {
      options.requestOptions.error(response, textStatus, errorThrown);
    }
  }

  /**
   * Attempt to cancel all active fetch requests
   */
  clear() {
    Object.values(this.activeRequests).forEach(r => r.cancel());
    this.activeRequests = {};
  }
}
