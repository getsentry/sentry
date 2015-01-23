/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var MemberListStore = require("../stores/memberListStore");
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

var AggregateListStore = Reflux.createStore({
  init: function() {
    // TODO(dcramer): what we want to actually do is keep this as a simple
    // list and have stream add/remove items as they're modified within stream
    // itself
    this.items = new utils.Collection();

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

  onAssignToCompleted: function(id, email) {
    var item = this.items.get(id);
    if (!item) {
      return;
    }
    if (email === '') {
      item.assignedTo = '';
    } else {
      var member = MemberListStore.getByEmail(email);
      if (member) {
        item.assignedTo = member;
      }
    }
    this.trigger(this.items);
  },

  onBulkDeleteCompleted: function(params) {
    AlertActions.addAlert(OK_SCHEDULE_DELETE, 'success');
  },

  onMergeCompleted: function(params) {
    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToFailed: function(id, email) {
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  }
});

module.exports = AggregateListStore;
