/*** @jsx React.DOM */

var $ = require("jquery");
var GroupActions = require("./actions/groupActions");
var TeamActions = require("./actions/teamActions");

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
    this.baseUrl = options.baseUrl || "/api/0";
    this.activeRequests = {};
  }

  uniqueId() {
    var s4 = () => {
      return Math.floor((1 + Math.random()) * 0x10000)
                 .toString(16)
                 .substring(1);
    };
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }

  wrapCallback(id, func, cleanup) {
    if (typeof func === "undefined") {
      return;
    }

    return () => {
      var req = this.activeRequests[id];
      if (cleanup === true) {
        delete this.activeRequests[id];
      }
      if (req.alive) {
        return func.apply(req, arguments);
      }
    };
  }

  request(path, options) {
    var query = $.param(options.query || "", true);
    var method = options.method || (options.data ? "POST" : "GET");
    var data = options.data;
    var id = this.uniqueId();

    if (typeof data !== "undefined") {
      data = JSON.stringify(data);
    }

    var fullUrl;
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
      success: this.wrapCallback(id, options.success),
      error: this.wrapCallback(id, options.error),
      complete: this.wrapCallback(id, options.complete, true)
    }));

    return this.activeRequests[id];
  }

  bulkDelete(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    GroupActions.delete(id, params.itemIds);

    return this.request(path, {
      query: query,
      method: "DELETE",
      success: (response) => {
        GroupActions.deleteSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.deleteError(id, params.itemIds, error);
      }
    });
  }

  bulkUpdate(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    GroupActions.update(id, params.itemIds, params.data);

    return this.request(path, {
      query: query,
      method: "PUT",
      data: params.data,
      success: (response) => {
        GroupActions.updateSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.updateError(id, params.itemIds, error, params.failSilently);
      }
    });
  }

  merge(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    GroupActions.merge(id, params.itemIds);

    return this.request(path, {
      query: query,
      method: "PUT",
      data: {merge: 1},
      success: (response) => {
        GroupActions.mergeSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        GroupActions.mergeError(id, params.itemIds, error);
      }
    });
  }

  assignTo(params) {
    var path = "/groups/" + params.id + "/";
    var id = this.uniqueId();

    GroupActions.assignTo(id, params.id, {email: params.email});

    return this.request(path, {
      method: "PUT",
      data: {assignedTo: params.email},
      success: (response) => {
        GroupActions.assignToSuccess(id, params.id, response);
      },
      error: (error) => {
        GroupActions.assignToError(id, params.id, error);
      }
    });
  }

  joinTeam(params) {
    var path = "/organizations/" + params.orgId + "/members/" + (params.memberId || 'me') + "/teams/" + params.teamId + "/";
    var id = this.uniqueId();

    TeamActions.update(id, params.teamId);

    return this.request(path, {
      method: "POST",
      success: (response) => {
        TeamActions.updateSuccess(id, params.teamId, response);
      },
      error: (error) => {
        TeamActions.updateError(id, params.teamId, error);
      }
    });
  }

  leaveTeam(params) {
    var path = "/organizations/" + params.orgId + "/members/" + (params.memberId || 'me') + "/teams/" + params.teamId + "/";
    var id = this.uniqueId();

    TeamActions.update(id, params.teamId);

    return this.request(path, {
      method: "DELETE",
      success: (response) => {
        TeamActions.updateSuccess(id, params.teamId, response);
      },
      error: (error) => {
        TeamActions.updateError(id, params.teamId, error);
      }
    });
  }
}

module.exports = new Client();
