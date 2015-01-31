/** @jsx React.DOM */

var Reflux = require("reflux");

var AlertActions = require("../actions/alertActions");
var AggregateListActions = require('../actions/aggregateListActions');
var MemberListStore = require("../stores/memberListStore");
var utils = require("../utils");

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

// TODO(dcramer): what we want to actually do is keep this as a simple
// list and have stream add/remove items as they're modified within stream
// itself
var _items = [];
var _pendingChanges = [];


var _bulkMutateAll = function(params, timestamp) {
  _items.forEach(function(item){
    if (!item._validAt || item._validAt <= timestamp) {
      $.extend(item, params);
      item._validAt = timestamp;
    }
  });
};

var bulkMutate = function(params, timestamp, itemIds) {
  var itemIdsHash = {};
  itemIds.forEach(function(id){
    itemIdsHash[id] = 1;
  });

  _items.forEach(function(item){
    if (typeof itemIdsHash[item.id] !== 'undefined') {
      if (!item._validAt || item._validAt <= timestamp) {
        $.extend(item, params);
        item._validAt = timestamp;
      }
    }
  });
};

var AggregateListStore = Reflux.createStore({
  init: function() {
    // TODO(dcramer): theres no documented way to do listenables via these
    this.listenTo(AggregateListActions.assignTo.completed, this.onAssignToCompleted);
    this.listenTo(AggregateListActions.assignTo.failed, this.onAssignToFailed);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData: function(items) {
    _items.splice(0);
    _pendingChanges.splice(0);
    items.forEach(function(item){
      _items.push(item);
    });
    this.trigger(this.getAllItems(), 'initial');
  },

  getItem: function(id) {
    var pendingForId = [];
    _pendingChanges.forEach(function(change){
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (var i = 0; i < _items.length; i++) {
      if (_items[i].id === id) {
        var rItem = _items[i];
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
    _pendingChanges.forEach(function(change){
      if (typeof pendingById[change.id] === 'undefined') {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    var results = [];
    _items.forEach(function(item){
      var rItem = item;
      if (typeof pendingById[item.id] !== 'undefined') {
        // copy the object so dirty state doesnt mutate original
        rItem = $.extend(true, {}, rItem);
        pendingById[item.id].forEach(function(change){
          rItem = $.extend(true, rItem, change.params);
        });
      }
      results.push(cItem);
    });
    return results;
  },

  onAssignToCompleted: function(id, email) {
    var item = _items.get(id);
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

  onBulkDeleteCompleted: function(params, timestamp) {
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
