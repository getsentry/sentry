import $ from 'jquery';
import GroupActions from './actions/groupActions';
import TeamActions from './actions/teamActions';

class Request {
  constructor(xhr) {
    this.xhr = xhr;
    this.alive = true;
  }

  cancel() {
    this.alive = false;
    this.xhr.abort();
  }
}

class Client {
  constructor(options) {
    if (typeof options === 'undefined') {
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
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }

  wrapCallback(id, func, cleanup) {
    /*eslint consistent-return:0*/
    if (typeof func === 'undefined') {
      return;
    }

    return (...args) => {
      let req = this.activeRequests[id];
      if (cleanup === true) {
        delete this.activeRequests[id];
      }
      if (req.alive) {
        return func.apply(req, args);
      }
    };
  }

  request(path, options = {}) {
    let query = $.param(options.query || '', true);
    let method = options.method || (options.data ? 'POST' : 'GET');
    let data = options.data;
    let id = this.uniqueId();

    if (typeof data !== 'undefined' && method !== 'GET') {
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

    this.activeRequests[id] = new Request($.ajax({
      url: fullUrl,
      method: method,
      data: data,
      contentType: 'application/json',
      headers: {
        'Accept': 'application/json; charset=utf-8'
      },
      success: this.wrapCallback(id, options.success),
      error: this.wrapCallback(id, options.error),
      complete: this.wrapCallback(id, options.complete, true)
    }));

    return this.activeRequests[id];
  }

  _chain(...funcs) {
    funcs = funcs.filter((f) => typeof f !== 'undefined' && f);
    return (...args) => {
      funcs.forEach((func) => {
        func.apply(funcs, args);
      });
    };
  }

  _wrapRequest(path, options, extraParams) {
    if (typeof extraParams === 'undefined') {
      extraParams = {};
    }

    options.success = this._chain(options.success, extraParams.success);
    options.error = this._chain(options.error, extraParams.error);
    options.complete = this._chain(options.complete, extraParams.complete);

    return this.request(path, options);
  }

  bulkDelete(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/groups/';
    let query = (params.itemIds ? {id: params.itemIds} : undefined);
    let id = this.uniqueId();

    GroupActions.delete(id, params.itemIds);

    return this._wrapRequest(path, {
      query: query,
      method: 'DELETE',
      success: (response) => {
        GroupActions.deleteSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.deleteError(id, params.itemIds, error);
      }
    }, options);
  }

  bulkUpdate(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/groups/';
    let query = (params.itemIds ? {id: params.itemIds} : undefined);
    let id = this.uniqueId();

    GroupActions.update(id, params.itemIds, params.data);

    return this._wrapRequest(path, {
      query: query,
      method: 'PUT',
      data: params.data,
      success: (response) => {
        GroupActions.updateSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.updateError(id, params.itemIds, error, params.failSilently);
      }
    }, options);
  }

  merge(params, options) {
    let path = '/projects/' + params.orgId + '/' + params.projectId + '/groups/';
    let query = (params.itemIds ? {id: params.itemIds} : undefined);
    let id = this.uniqueId();

    GroupActions.merge(id, params.itemIds);

    return this._wrapRequest(path, {
      query: query,
      method: 'PUT',
      data: {merge: 1},
      success: (response) => {
        GroupActions.mergeSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.mergeError(id, params.itemIds, error);
      }
    }, options);
  }

  assignTo(params, options) {
    let path = '/groups/' + params.id + '/';
    let id = this.uniqueId();

    GroupActions.assignTo(id, params.id, {email: params.email});

    return this._wrapRequest(path, {
      method: 'PUT',
      data: {assignedTo: params.email},
      success: (response) => {
        GroupActions.assignToSuccess(id, params.id, response);
      },
      error: (error) => {
        GroupActions.assignToError(id, params.id, error);
      }
    }, options);
  }

  joinTeam(params, options) {
    let path = '/organizations/' + params.orgId + '/members/' + (params.memberId || 'me') + '/teams/' + params.teamId + '/';
    let id = this.uniqueId();

    TeamActions.update(id, params.teamId);

    return this._wrapRequest(path, {
      method: 'POST',
      success: (response) => {
        TeamActions.updateSuccess(id, params.teamId, response);
      },
      error: (error) => {
        TeamActions.updateError(id, params.teamId, error);
      }
    }, options);
  }

  leaveTeam(params, options) {
    let path = '/organizations/' + params.orgId + '/members/' + (params.memberId || 'me') + '/teams/' + params.teamId + '/';
    let id = this.uniqueId();

    TeamActions.update(id, params.teamId);

    return this._wrapRequest(path, {
      method: 'DELETE',
      success: (response) => {
        TeamActions.updateSuccess(id, params.teamId, response);
      },
      error: (error) => {
        TeamActions.updateError(id, params.teamId, error);
      }
    }, options);
  }
}

export default new Client();
