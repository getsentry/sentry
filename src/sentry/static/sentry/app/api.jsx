import $ from 'jquery';
import {isUndefined, isNil} from 'lodash';
import * as Sentry from '@sentry/browser';

import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'app/constants/apiErrorCodes';
import {metric} from 'app/utils/analytics';
import {openSudo, redirectToProject} from 'app/actionCreators/modal';
import GroupActions from 'app/actions/groupActions';
import {uniqueId} from 'app/utils/guid';
import * as tracing from 'app/utils/tracing';

export class Request {
  constructor(xhr) {
    this.xhr = xhr;
    this.alive = true;
  }

  cancel() {
    this.alive = false;
    this.xhr.abort();
    metric('app.api.request-abort', 1);
  }
}

/**
 * Converts input parameters to API-compatible query arguments
 * @param params
 */
export function paramsToQueryArgs(params) {
  let p = params.itemIds
    ? {id: params.itemIds} // items matching array of itemids
    : params.query
      ? {query: params.query} // items matching search query
      : undefined; // all items

  // only include environment if it is not null/undefined
  if (params.query && !isNil(params.environment)) {
    p.environment = params.environment;
  }
  return p;
}

export class Client {
  constructor(options) {
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
  hasProjectBeenRenamed(response) {
    let code = response?.responseJSON?.detail?.code;

    // XXX(billy): This actually will never happen because we can't intercept the 302
    // jQuery ajax will follow the redirect by default...
    if (code !== PROJECT_MOVED) return false;

    let slug = response?.responseJSON?.detail?.extra?.slug;

    redirectToProject(slug);
    return true;
  }

  wrapCallback(id, func, cleanup) {
    /*eslint consistent-return:0*/
    if (isUndefined(func)) {
      return;
    }

    return (...args) => {
      let req = this.activeRequests[id];
      if (cleanup === true) {
        delete this.activeRequests[id];
      }
      if (req && req.alive) {
        // Check if API response is a 302 -- means project slug was renamed and user
        // needs to be redirected
        if (this.hasProjectBeenRenamed(...args)) return;

        // Call success callback
        return func.apply(req, args);
      }
    };
  }

  /**
   * Attempt to cancel all active XHR requests
   */
  clear() {
    for (let id in this.activeRequests) {
      this.activeRequests[id].cancel();
    }
  }

  handleRequestError({id, path, requestOptions}, response, ...responseArgs) {
    let code = response?.responseJSON?.detail?.code;
    let isSudoRequired = code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED;

    if (isSudoRequired) {
      openSudo({
        superuser: code === SUPERUSER_REQUIRED,
        sudo: code === SUDO_REQUIRED,
        retryRequest: () => {
          return this.requestPromise(path, requestOptions)
            .then((...args) => {
              if (typeof requestOptions.success !== 'function') return;

              requestOptions.success(...args);
            })
            .catch((...args) => {
              if (typeof requestOptions.error !== 'function') return;
              requestOptions.error(...args);
            });
        },
        onClose: () => {
          if (typeof requestOptions.error !== 'function') return;
          // If modal was closed, then forward the original response
          requestOptions.error(response);
        },
      });
      return;
    }

    // Call normal error callback
    let errorCb = this.wrapCallback(id, requestOptions.error);
    if (typeof errorCb !== 'function') return;
    errorCb(response, ...responseArgs);
  }

  request(path, options = {}) {
    let query;
    try {
      query = $.param(options.query || '', true);
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setExtra('path', path);
        scope.setExtra('query', options.query);
        Sentry.captureException(err);
      });
      throw err;
    }
    let method = options.method || (options.data ? 'POST' : 'GET');
    let data = options.data;
    let id = uniqueId();
    metric.mark(`api-request-start-${id}`);

    if (!isUndefined(data) && method !== 'GET') {
      data = JSON.stringify(data);
    }

    let fullUrl;
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

    this.activeRequests[id] = new Request(
      $.ajax({
        url: fullUrl,
        method,
        data,
        contentType: 'application/json',
        headers: {
          Accept: 'application/json; charset=utf-8',
          'X-Transaction-ID': tracing.getTransactionId(),
          'X-Span-ID': tracing.getSpanId(),
        },
        success: (...args) => {
          let [, , xhr] = args || [];
          metric.measure({
            name: 'app.api.request-success',
            start: `api-request-start-${id}`,
            data: {
              status: xhr && xhr.status,
            },
          });
          if (!isUndefined(options.success)) {
            this.wrapCallback(id, options.success)(...args);
          }
        },
        error: (...args) => {
          let [, , xhr] = args || [];
          metric.measure({
            name: 'app.api.request-error',
            start: `api-request-start-${id}`,
            data: {
              status: xhr && xhr.status,
            },
          });
          this.handleRequestError(
            {
              id,
              path,
              requestOptions: options,
            },
            ...args
          );
        },
        complete: this.wrapCallback(id, options.complete, true),
      })
    );

    return this.activeRequests[id];
  }

  requestPromise(path, {includeAllArgs, ...options} = {}) {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          includeAllArgs ? resolve([data, ...args]) : resolve(data);
        },
        error: (error, ...args) => {
          reject(error);
        },
      });
    });
  }

  _chain(...funcs) {
    funcs = funcs.filter(f => !isUndefined(f) && f);
    return (...args) => {
      funcs.forEach(func => {
        func.apply(funcs, args);
      });
    };
  }

  _wrapRequest(path, options, extraParams) {
    if (isUndefined(extraParams)) {
      extraParams = {};
    }

    options.success = this._chain(options.success, extraParams.success);
    options.error = this._chain(options.error, extraParams.error);
    options.complete = this._chain(options.complete, extraParams.complete);

    return this.request(path, options);
  }

  bulkDelete(params, options) {
    let path = params.projectId
      ? `/projects/${params.orgId}/${params.projectId}/issues/`
      : `/organizations/${params.orgId}/issues/`;

    let query = paramsToQueryArgs(params);
    let id = uniqueId();

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

  bulkUpdate(params, options) {
    let path = params.projectId
      ? `/projects/${params.orgId}/${params.projectId}/issues/`
      : `/organizations/${params.orgId}/issues/`;

    let query = paramsToQueryArgs(params);
    let id = uniqueId();

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

  merge(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/issues/';
    let query = paramsToQueryArgs(params);
    let id = uniqueId();

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
