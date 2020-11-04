import isUndefined from 'lodash/isUndefined';
import isNil from 'lodash/isNil';
import $ from 'jquery';
import {Severity} from '@sentry/react';

import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'app/constants/apiErrorCodes';
import {run} from 'app/utils/apiSentryClient';
import {metric} from 'app/utils/analytics';
import {openSudo, redirectToProject} from 'app/actionCreators/modal';
import {uniqueId} from 'app/utils/guid';
import GroupActions from 'app/actions/groupActions';
import createRequestError from 'app/utils/requestError/createRequestError';

export class Request {
  alive: boolean;
  xhr: JQueryXHR;

  constructor(xhr: JQueryXHR) {
    this.xhr = xhr;
    this.alive = true;
  }

  cancel() {
    this.alive = false;
    this.xhr.abort();
    metric('app.api.request-abort', 1);
  }
}

type ParamsType = {
  itemIds?: Array<number> | Array<string>;
  query?: string;
  environment?: string | Array<string> | null;
  project?: Array<number> | null;
};

type QueryArgs =
  | {
      query: string;
      environment?: string | Array<string>;
      project?: Array<number>;
    }
  | {
      id: Array<number>;
      environment?: string | Array<string>;
      project?: Array<number>;
    }
  | {
      environment?: string | Array<string>;
      project?: Array<number>;
    };

/**
 * Converts input parameters to API-compatible query arguments
 * @param params
 */
export function paramsToQueryArgs(params: ParamsType): QueryArgs {
  const p: QueryArgs = params.itemIds
    ? {id: params.itemIds} // items matching array of itemids
    : params.query
    ? {query: params.query} // items matching search query
    : {}; // all items

  // only include environment if it is not null/undefined
  if (params.query && !isNil(params.environment)) {
    p.environment = params.environment;
  }

  // only include projects if it is not null/undefined/an empty array
  if (params.project && params.project.length) {
    p.project = params.project;
  }

  // only include date filters if they are not null/undefined
  if (params.query) {
    ['start', 'end', 'period', 'utc'].forEach(prop => {
      if (!isNil(params[prop])) {
        p[prop === 'period' ? 'statsPeriod' : prop] = params[prop];
      }
    });
  }
  return p;
}

// TODO: move this somewhere
export type APIRequestMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

type FunctionCallback<Args extends any[] = any[]> = (...args: Args) => void;

type RequestCallbacks = {
  success?: (data: any, textStatus?: string, xhr?: JQueryXHR) => void;
  complete?: (jqXHR: JQueryXHR, textStatus: string) => void;
  // TODO(ts): Update this when sentry is mostly migrated to TS
  error?: FunctionCallback;
};

export type RequestOptions = {
  method?: APIRequestMethod;
  data?: any;
  query?: Array<any> | object;
  preservedError?: Error;
} & RequestCallbacks;

export class Client {
  baseUrl: string;
  activeRequests: {[ids: string]: Request};

  constructor(options: {baseUrl?: string} = {}) {
    if (isUndefined(options)) {
      options = {};
    }
    this.baseUrl = options.baseUrl || '/api/0';
    this.activeRequests = {};
  }

  /**
   * Check if the API response says project has been renamed.
   * If so, redirect user to new project slug
   */
  // TODO: refine this type later
  hasProjectBeenRenamed(response: JQueryXHR) {
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
        if (this.hasProjectBeenRenamed(...args)) {
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
  clear(): void {
    for (const id in this.activeRequests) {
      this.activeRequests[id].cancel();
    }
  }

  handleRequestError(
    {
      id,
      path,
      requestOptions,
    }: {id: string; path: string; requestOptions: Readonly<RequestOptions>},
    response: JQueryXHR,
    textStatus: string,
    errorThrown: string
  ) {
    const code = response?.responseJSON?.detail?.code;
    const isSudoRequired = code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED;

    if (isSudoRequired) {
      openSudo({
        superuser: code === SUPERUSER_REQUIRED,
        sudo: code === SUDO_REQUIRED,
        retryRequest: () =>
          this.requestPromise(path, requestOptions)
            .then(data => {
              if (typeof requestOptions.success !== 'function') {
                return;
              }

              requestOptions.success(data);
            })
            .catch(err => {
              if (typeof requestOptions.error !== 'function') {
                return;
              }
              requestOptions.error(err);
            }),
        onClose: () => {
          if (typeof requestOptions.error !== 'function') {
            return;
          }
          // If modal was closed, then forward the original response
          requestOptions.error(response);
        },
      });
      return;
    }

    // Call normal error callback
    const errorCb = this.wrapCallback<[JQueryXHR, string, string]>(
      id,
      requestOptions.error
    );
    if (typeof errorCb !== 'function') {
      return;
    }
    errorCb(response, textStatus, errorThrown);
  }

  request(path: string, options: Readonly<RequestOptions> = {}): Request {
    const method = options.method || (options.data ? 'POST' : 'GET');
    let data = options.data;

    if (!isUndefined(data) && method !== 'GET') {
      data = JSON.stringify(data);
    }

    let query: string;
    try {
      query = $.param(options.query || [], true);
    } catch (err) {
      run(Sentry =>
        Sentry.withScope(scope => {
          scope.setExtra('path', path);
          scope.setExtra('query', options.query);
          Sentry.captureException(err);
        })
      );
      throw err;
    }

    const id: string = uniqueId();
    metric.mark({name: `api-request-start-${id}`});

    let fullUrl: string;
    if (path.indexOf(this.baseUrl) === -1) {
      fullUrl = this.baseUrl + path;
    } else {
      fullUrl = path;
    }
    if (query) {
      if (fullUrl.indexOf('?') !== -1) {
        fullUrl += '&' + query;
      } else {
        fullUrl += '?' + query;
      }
    }

    const errorObject = new Error();

    this.activeRequests[id] = new Request(
      $.ajax({
        url: fullUrl,
        method,
        data,
        contentType: 'application/json',
        headers: {
          Accept: 'application/json; charset=utf-8',
        },
        success: (responseData: any, textStatus: string, xhr: JQueryXHR) => {
          metric.measure({
            name: 'app.api.request-success',
            start: `api-request-start-${id}`,
            data: {
              status: xhr && xhr.status,
            },
          });
          if (!isUndefined(options.success)) {
            this.wrapCallback<[any, string, JQueryXHR]>(id, options.success)(
              responseData,
              textStatus,
              xhr
            );
          }
        },
        error: (resp: JQueryXHR, textStatus: string, errorThrown: string) => {
          metric.measure({
            name: 'app.api.request-error',
            start: `api-request-start-${id}`,
            data: {
              status: resp && resp.status,
            },
          });

          if (resp && resp.status !== 0 && resp.status !== 404) {
            run(Sentry =>
              Sentry.withScope(scope => {
                // `requestPromise` can pass its error object
                const preservedError = options.preservedError || errorObject;

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
                Sentry.captureException(errorObjectToUse);
              })
            );
          }

          this.handleRequestError(
            {
              id,
              path,
              requestOptions: options,
            },
            resp,
            textStatus,
            errorThrown
          );
        },
        complete: (jqXHR: JQueryXHR, textStatus: string) =>
          this.wrapCallback<[JQueryXHR, string]>(
            id,
            options.complete,
            true
          )(jqXHR, textStatus),
      })
    );

    return this.activeRequests[id];
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
    // that we have a helpful stacktrace if it errors
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

  _chain<Args extends any[]>(...funcs: Array<((...args: Args) => any) | undefined>) {
    const filteredFuncs = funcs.filter(
      (f): f is (...args: Args) => any => typeof f === 'function'
    );
    return (...args: Args): void => {
      filteredFuncs.forEach(func => {
        func.apply(funcs, args);
      });
    };
  }

  _wrapRequest(
    path: string,
    options: RequestOptions,
    extraParams: RequestCallbacks
  ): Request {
    if (isUndefined(extraParams)) {
      extraParams = {};
    }

    options.success = this._chain(options.success, extraParams.success);
    options.error = this._chain(options.error, extraParams.error);
    options.complete = this._chain(options.complete, extraParams.complete);

    return this.request(path, options);
  }

  bulkDelete(
    params: ParamsType & {orgId: string; projectId?: string},
    options: RequestCallbacks
  ): Request {
    const path: string = params.projectId
      ? `/projects/${params.orgId}/${params.projectId}/issues/`
      : `/organizations/${params.orgId}/issues/`;

    const query: QueryArgs = paramsToQueryArgs(params);
    const id: string = uniqueId();

    GroupActions.delete(id, params.itemIds);

    return this._wrapRequest(
      path,
      {
        query,
        method: 'DELETE',
        success: response => {
          GroupActions.deleteSuccess(id, params.itemIds, response);
        },
        error: error => {
          GroupActions.deleteError(id, params.itemIds, error);
        },
      },
      options
    );
  }

  bulkUpdate(
    params: ParamsType & {
      orgId: string;
      projectId?: string;
      failSilently?: boolean;
      data?: any;
    },
    options: RequestCallbacks
  ): Request {
    const path: string = params.projectId
      ? `/projects/${params.orgId}/${params.projectId}/issues/`
      : `/organizations/${params.orgId}/issues/`;

    const query: QueryArgs = paramsToQueryArgs(params);
    const id: string = uniqueId();

    GroupActions.update(id, params.itemIds, params.data);

    return this._wrapRequest(
      path,
      {
        query,
        method: 'PUT',
        data: params.data,
        success: response => {
          GroupActions.updateSuccess(id, params.itemIds, response);
        },
        error: error => {
          GroupActions.updateError(id, params.itemIds, error, params.failSilently);
        },
      },
      options
    );
  }

  merge(
    params: ParamsType & {
      orgId: string;
      projectId?: string;
    },
    options: RequestCallbacks
  ): Request {
    const path: string = params.projectId
      ? `/projects/${params.orgId}/${params.projectId}/issues/`
      : `/organizations/${params.orgId}/issues/`;

    const query: QueryArgs = paramsToQueryArgs(params);
    const id: string = uniqueId();

    GroupActions.merge(id, params.itemIds);

    return this._wrapRequest(
      path,
      {
        query,
        method: 'PUT',
        data: {merge: 1},
        success: response => {
          GroupActions.mergeSuccess(id, params.itemIds, response);
        },
        error: error => {
          GroupActions.mergeError(id, params.itemIds, error);
        },
      },
      options
    );
  }
}
