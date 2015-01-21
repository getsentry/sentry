/** @jsx React.DOM */

var Reflux = require("reflux");

// TODO(dcramer): we should probably just make every parameter update
// work on bulk aggregates
// TODO(dcramer): define a spec for action parameterization and children
// i.e. in(params) => out(params, response)
var AggregateListActions = Reflux.createActions({
  "assignTo": {
    children: ["completed", "failed"]
  },
  "bulkUpdate": {
    children: ["completed", "failed"]
  }
});

AggregateListActions.assignTo.listen(function(itemId, userEmail){
  if (!itemId) {
    this.failed(itemId, userEmail);
    return false;
  }

  $.ajax({
    url: '/api/0/groups/' + itemId + '/',
    method: 'PUT',
    data: JSON.stringify({
      assignedTo: userEmail
    }),
    contentType: 'application/json',
    success: function(data){
      this.completed(itemId, userEmail, data);
    }.bind(this),
    error: function(){
      this.failed(itemId, userEmail);
    }.bind(this)
  });
});

AggregateListActions.bulkUpdate.listen(function(params){
  var url = '/api/0/projects/' + params.orgId + '/' + params.projectId + '/groups/';
  url += '?id=' + params.itemIds.join('&id=');

  $.ajax({
    url: url,
    method: 'PUT',
    data: JSON.stringify(params.data),
    contentType: 'application/json',
    success: function(data){
      this.completed(params, data);
    }.bind(this),
    error: function(){
      this.failed(params);
    }.bind(this)
  });
});

module.exports = AggregateListActions;
