import $ from 'jquery';
import _ from 'lodash';

import GroupActions from './actions/groupActions';
import {openSudo} from './actionCreators/modal';

export class Request {
  constructor(xhr) {
    this.xhr = xhr;
    this.alive = true;
  }

  cancel() {
    this.alive = false;
    this.xhr.abort();
  }
}

/**
 * Converts input parameters to API-compatible query arguments
 * @param params
 */
export function paramsToQueryArgs(params) {
  return params.itemIds
    ? {id: params.itemIds} // items matching array of itemids
    : params.query
      ? {query: params.query} // items matching search query
      : undefined; // all items
}

export class Client {
  constructor(options) {
    if (_.isUndefined(options)) {
      options = {};
    }
    this.baseUrl = options.baseUrl || '/api/0';
    this.activeRequests = {};
  }

  uniqueId() {
    let s4 = () => {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    };
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  wrapCallback(id, func, cleanup) {
    /*eslint consistent-return:0*/
    if (_.isUndefined(func)) {
      return;
    }

    return (...args) => {
      let req = this.activeRequests[id];
      if (cleanup === true) {
        delete this.activeRequests[id];
      }
      if (req && req.alive) {
        return func.apply(req, args);
      }
    };
  }

  clear() {
    for (let id in this.activeRequests) {
      this.activeRequests[id].cancel();
    }
  }

  handleRequestError({id, path, requestOptions}, response, ...responseArgs) {
    let isSudoRequired =
      response && response.responseJSON && response.responseJSON.sudoRequired;

    if (isSudoRequired) {
      openSudo({
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
          requestOptions.error();
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
    let query = $.param(options.query || '', true);
    let method = options.method || (options.data ? 'POST' : 'GET');
    let data = options.data;
    let id = this.uniqueId();

    if (!_.isUndefined(data) && method !== 'GET') {
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
        },
        success: this.wrapCallback(id, options.success),
        error: (...args) =>
          this.handleRequestError(
            {
              id,
              path,
              requestOptions: options,
            },
            ...args
          ),
        complete: this.wrapCallback(id, options.complete, true),
      })
    );

    return this.activeRequests[id];
  }

  requestPromise(path, options = {}) {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          resolve(data);
        },
        error: (error, ...args) => {
          reject(error);
        },
      });
    });
  }

  _chain(...funcs) {
    funcs = funcs.filter(f => !_.isUndefined(f) && f);
    return (...args) => {
      funcs.forEach(func => {
        func.apply(funcs, args);
      });
    };
  }

  _wrapRequest(path, options, extraParams) {
    if (_.isUndefined(extraParams)) {
      extraParams = {};
    }

    options.success = this._chain(options.success, extraParams.success);
    options.error = this._chain(options.error, extraParams.error);
    options.complete = this._chain(options.complete, extraParams.complete);

    return this.request(path, options);
  }

  bulkDelete(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/issues/';
    let query = paramsToQueryArgs(params);
    let id = this.uniqueId();

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
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/issues/';
    let query = paramsToQueryArgs(params);
    let id = this.uniqueId();

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
    let id = this.uniqueId();

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

  assignTo(params, options) {
    let path = '/issues/' + params.id + '/';
    let id = this.uniqueId();

    GroupActions.assignTo(id, params.id, {
      email: (params.member && params.member.email) || '',
    });

    return this._wrapRequest(
      path,
      {
        method: 'PUT',
        // Sending an empty value to assignedTo is the same as "clear",
        // so if no member exists, that implies that we want to clear the
        // current assignee.
        data: {assignedTo: (params.member && params.member.id) || ''},
        success: response => {
          GroupActions.assignToSuccess(id, params.id, response);
        },
        error: error => {
          GroupActions.assignToError(id, params.id, error);
        },
      },
      options
    );
  }
}
