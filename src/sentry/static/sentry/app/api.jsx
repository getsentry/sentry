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
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
                 .toString(16)
                 .substring(1);
    }
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

    $.ajax({
      url: this.baseUrl + path + "?" + query,
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
      success: function(response){
       AggregateListActions.deleteSuccess(id, params.itemIds, response);
      },
      error: function(error){
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
      success: function(response){
       AggregateListActions.updateSuccess(id, params.itemIds, response);
      },
      error: function(error){
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
      success: function(response){
       AggregateListActions.mergeSuccess(id, params.itemIds, response);
      },
      error: function(error){
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
      success: function(response){
       AggregateListActions.assignToSuccess(id, params.id, response);
      },
      error: function(error){
       AggregateListActions.assignToError(id, params.id, error);
      }
    });
  }
}

module.exports = new Client();
