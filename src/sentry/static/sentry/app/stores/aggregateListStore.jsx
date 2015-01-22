/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var MemberListStore = require("../stores/memberListStore");
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';

var AggregateListStore = Reflux.createStore({
  init: function() {
    // TODO(dcramer): what we want to actually do is keep this as a simple
    // list and have stream add/remove items as they're modified within stream
    // itself
    this.items = new utils.Collection();
    this.members = [];

    // TODO(dcramer): theres no documented way to do listenables via these
    this.listenTo(AggregateListActions.assignTo.completed, this.onAssignToCompleted);
    this.listenTo(AggregateListActions.assignTo.failed, this.onAssignToFailed);

    this.listenTo(AggregateListActions.bulkUpdate.completed, this.onBulkUpdateCompleted);

    // listen to changes in member store so we can find project members for
    // use with mutating assignedTo
    this.listenTo(MemberListStore, function(members){
      this.members = members;
    }.bind(this));
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
      for (var i=0; i<this.members.length; i++) {
        if (this.members[i].email === email) {
          item.assignedTo = this.members[i];
          break;
        }
      }
    }
    this.trigger(this.items);
  },

  onBulkUpdateCompleted: function(params) {
    this.items.forEach(function(item){
      if (params.itemIds.indexOf(item.id) !== -1) {
        $.extend(true, item, data);
      }
    });
    this.trigger(this.items);
  },


  // TODO(dcramer): This is not really the best place for this
  onAssignToFailed: function(id, email) {
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  }
});

module.exports = AggregateListStore;
