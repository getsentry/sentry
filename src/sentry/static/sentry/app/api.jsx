/*** @jsx React.DOM */

var $ = require("jquery");

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
      success: options.success,
      error: options.error,
      complete: options.complete
    });
  }

  bulkUpdate(params) {
    var path = "/projects/" + params.orgId + "/" + params.projectId + "/groups/";
    var query = (params.itemIds ? {id: params.itemIds} : undefined);
    var id = this.uniqueId();

    AggregateListActions.bulkUpdate(id, params.itemIds, params.data);

    return this.request(path, {
      query: query,
      method: "PUT",
      data: params.data,
      success: function(response){
       AggregateListActions.bulkUpdateSuccess(id, params.itemIds, response);
      },
      error: function(error){
       AggregateListActions.bulkUpdateError(id, params.itemIds, error);
      }
    });
  }

  assignTo(params) {
    var path = "/groups/" + params.id + "/";

    AggregateListActions.assignTo(params);

    return this.request(path, {
      method: "PUT",
      data: params.data,
      success: function(data){
       AggregateListActions.assignToSuccess(params, data);
      },
      error: function(error){
       AggregateListActions.assignToError(params, error);
      }
    });
  }
}

module.exports = new Client();
