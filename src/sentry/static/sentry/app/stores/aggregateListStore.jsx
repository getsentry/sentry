/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';

var AggregateListStore = Reflux.createStore({
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

    // TODO(dcramer): theres no documented way to do listenables via these
    this.listenTo(AggregateListActions.assignTo.completed, this.onAssignToCompleted);
    this.listenTo(AggregateListActions.assignTo.failed, this.onAssignToFailed);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData: function(items) {
    this.items.empty();
    this.items.push(items);
    this.trigger(this.items, 'initial');
  },

  onAssignToCompleted: function(id, email, data) {
    this.items.update(data);
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToFailed: function(id, email) {
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  }
});

module.exports = AggregateListStore;
