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
    this.items = [];
    this.pendingChanges = new utils.PendingChangeQueue();

    this.listenTo(AggregateListActions.update, this.onUpdate);
    this.listenTo(AggregateListActions.updateError, this.onUpdateError);
    this.listenTo(AggregateListActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(AggregateListActions.assignTo, this.onAssignTo);
    this.listenTo(AggregateListActions.assignToError, this.onAssignToError);
    this.listenTo(AggregateListActions.assignToSuccess, this.onAssignToSuccess);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData: function(items) {
    this.items = [];
    this.pendingChanges.clear();
    items.forEach(item => {
      this.items.push(item);
    });
    this.trigger(this.getAllItems());
  },

  getItem: function(id) {
    var pendingForId = [];
    this.pendingChanges.forEach(function(change){
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        var rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = $.extend(true, {}, rItem);

          for (var c = 0; c < pendingForId.length; c++) {
            rItem = $.extend(true, rItem, pendingForId[c].params);
          }
        }
        return rItem;
      }
    }
  },

  getAllItems: function() {
    // regroup pending changes by their itemID
    var pendingById = {};
    this.pendingChanges.forEach(change => {
      if (typeof pendingById[change.id] === 'undefined') {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    return this.items.map(item => {
      var rItem = item;
      if (typeof pendingById[item.id] !== 'undefined') {
        // copy the object so dirty state doesnt mutate original
        rItem = $.extend(true, {}, rItem);
        pendingById[item.id].forEach(change => {
          rItem = $.extend(true, rItem, change.params);
        });
      }
      return rItem;
    });
  },

  // re-fire bulk events as individual actions
  // XXX(dcramer): ideally we could do this as part of the actions API but
  // there's no way for us to know "all events" for us to actually fire the action
  // on each individual event when its a global action (i.e. id-less)
  onUpdate: function(id, itemIds, data){
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    itemIds.forEach(item => {
      this.pendingChanges.push(id, itemId, data);
    });
    this.trigger(this.getAllItems());
  },

  onpdateError: function(id, itemIds, error){
    this.pendingChanges.remove(id);
    this.trigger(this.getAllItems());
  },

  onpdateSuccess: function(id, itemIds, response){
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    itemIds.forEach(item => {
      $.extend(true, item, response);
    });
    this.pendingChanges.remove(id);
    this.trigger(this.getAllItems());
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError: function(id, email) {
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  },

  onAssignToSuccess: function(id, email) {
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
    this.trigger(_items);
  },

  onDeleteCompleted: function(params) {
    AlertActions.addAlert(OK_SCHEDULE_DELETE, 'success');
  },

  onMergeCompleted: function(params) {
    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
  }
});

module.exports = AggregateListStore;
