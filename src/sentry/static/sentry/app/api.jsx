/*** @jsx React.DOM */

var $ = require("jquery");
var AggregateListActions = require("./actions/aggregateListActions");

class Client {
  constructor(options) {
    if (typeof options === 'undefined') {
      options = {};
    }
    this.baseUrl = options.baseUrl || "/api/0";
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

  request(path, options) {
    var query = $.param(options.query || "", true);
    var method = options.method || (options.data ? "POST" : "GET");
    var data = options.data;

    if (typeof data !== "undefined") {
      data = JSON.stringify(data);
    }

    var fullUrl = this.baseUrl + path;
    if (query) {
      if (fullUrl.indexOf('?') !== -1) {
        fullUrl += '&' + query;
      } else {
        fullUrl += '?' + query;
      }
    }

    $.ajax({
      url: fullUrl,
      method: method,
      data: data,
      contentType: 'application/json',
      success: options.success,
      error: options.error,
      complete: options.complete
    });
  }

  bulkDelete(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    AggregateListActions.delete(id, params.itemIds);

    return this.request(path, {
      query: query,
      method: "DELETE",
      success: (response) => {
        AggregateListActions.deleteSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        AggregateListActions.deleteError(id, params.itemIds, error);
      }
    });
  }

  bulkUpdate(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    AggregateListActions.update(id, params.itemIds, params.data);

    return this.request(path, {
      query: query,
      method: "PUT",
      data: params.data,
      success: (response) => {
        AggregateListActions.updateSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        AggregateListActions.updateError(id, params.itemIds, error);
      }
    });
  }

  merge(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    AggregateListActions.merge(id, params.itemIds);

    return this.request(path, {
      query: query,
      method: "PUT",
      data: {merge: 1},
      success: (response) => {
        AggregateListActions.mergeSuccess(id, params.itemIds, response);
      },
      error: (error) => {
        AggregateListActions.mergeError(id, params.itemIds, error);
      }
    });
  }

  assignTo(params) {
    var path = "/groups/" + params.id + "/";
    var id = this.uniqueId();

    AggregateListActions.assignTo(id, params.id, {email: params.email});

    return this.request(path, {
      method: "PUT",
      data: {assignedTo: params.email},
      success: (response) => {
        AggregateListActions.assignToSuccess(id, params.id, response);
      },
      error: (error) => {
        AggregateListActions.assignToError(id, params.id, error);
      }
    });
  }
}

module.exports = new Client();
