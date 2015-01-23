/*** @jsx React.DOM */

var $ = require("jquery");

var Client = function(){
  this.baseUrl = "/api/0";
};

Client.prototype.request = function(path, options) {
  $.ajax({
    url: this.baseUrl + path,
    method: options.method || 'GET',
    success: options.success,
    error: options.error,
    complete: options.complete
  });
};

module.exports = new Client();
