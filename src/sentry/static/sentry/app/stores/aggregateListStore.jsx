/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';

var AggregateListStore = Reflux.createStore({
  listenables: AggregateListActions,

  init: function() {
    // TODO(dcramer): what we want to actually do is keep this as a simple
    // list and have stream add/remove items as they're modified within stream
    // itself
    this.items = new utils.Collection([], {
      equals: function(self, other) {
        return self.id === other.id;
      },
      limit: 50
    });
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData: function(items) {
    this.items.empty();
    this.items.push(items);
    this.trigger(this.items, 'initial');
  },

  onSetAssignedTo: function(itemId, userEmail, cb) {
    $.ajax({
      url: '/api/0/groups/' + itemId + '/',
      method: 'PUT',
      data: JSON.stringify({
        assignedTo: userEmail
      }),
      contentType: 'application/json',
      success: function(data){
        this.items.update(data);
        this.trigger(this.items, 'assignedTo', itemId, userEmail);
        cb(data);
      }.bind(this),
      error: function(){
        AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
        cb();
      }.bind(this)
    });
  }
});

module.exports = AggregateListStore;
