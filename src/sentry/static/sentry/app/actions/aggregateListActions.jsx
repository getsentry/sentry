/** @jsx React.DOM */

var Reflux = require("reflux");

var AggregateListActions = Reflux.createActions({
  "assignTo": {
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


module.exports = AggregateListActions;
