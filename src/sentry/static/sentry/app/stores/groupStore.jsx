
import jQuery from "jquery";
import Reflux from "reflux";
import AlertActions from "../actions/alertActions";
import GroupActions from '../actions/groupActions';
import MemberListStore from "../stores/memberListStore";
import utils from "../utils";

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var ERR_SCHEDULE_DELETE = 'Unable to delete events. Please try again.';
var ERR_SCHEDULE_MERGE = 'Unable to merge events. Please try again.';
var ERR_UPDATE = 'Unable to update events. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

var GroupStore = Reflux.createStore({
  init() {
    this.items = [];
    this.statuses = {};
    this.pendingChanges = new utils.PendingChangeQueue();

    this.listenTo(GroupActions.assignTo, this.onAssignTo);
    this.listenTo(GroupActions.assignToError, this.onAssignToError);
    this.listenTo(GroupActions.assignToSuccess, this.onAssignToSuccess);
    this.listenTo(GroupActions.delete, this.onDelete);
    this.listenTo(GroupActions.deleteError, this.onDeleteError);
    this.listenTo(GroupActions.merge, this.onMerge);
    this.listenTo(GroupActions.mergeError, this.onMergeError);
    this.listenTo(GroupActions.update, this.onUpdate);
    this.listenTo(GroupActions.updateError, this.onUpdateError);
    this.listenTo(GroupActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.items = [];
    this.statuses = {};
    this.pendingChanges.clear();
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.reset();

    var itemIds = new Set();
    items.forEach((item) => {
      itemIds.add(item.id);
      this.items.push(item);
    });

    this.trigger(itemIds);
  },

  add(items) {
    if (!items instanceof Array) {
      items = [items];
    }

    var itemsById = {};
    var itemIds = new Set();
    items.forEach((item) => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    });

    items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = jQuery.extend(true, {}, item, itemsById[item.id]);
        delete itemsById[item.id];
      }
    });

    for (var itemId in itemsById) {
      this.items.push(itemsById[itemId]);
    }

    this.trigger(itemIds);
  },

  remove(itemId) {
    this.items.forEach((item, idx) => {
      if (item.id === itemId) {
        this.items.splice(idx, idx + 1);
      }
    });

    this.trigger(new Set([itemId]));
  },

  addStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      this.statuses[id] = {};
    }
    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return;
    }
    this.statuses[id][status] = false;
  },

  hasStatus(id, status) {
    if (typeof this.statuses[id] === 'undefined') {
      return false;
    }
    return this.statuses[id][status] || false;
  },

  addActivity(id, data) {
    var group = this.get(id);
    if (!group) {
      return;
    }
    group.activity.unshift(data);
    this.trigger(new Set([id]));
  },

  get(id) {
    var pendingForId = [];
    this.pendingChanges.forEach(change => {
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        var rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = jQuery.extend(true, {}, rItem);

          for (var c = 0; c < pendingForId.length; c++) {
            rItem = jQuery.extend(true, rItem, pendingForId[c].params);
          }
        }
        return rItem;
      }
    }
  },

  getAllItemIds() {
    return this.items.map((item) => item.id);
  },

  getAllItems() {
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
        rItem = jQuery.extend(true, {}, rItem);
        pendingById[item.id].forEach(change => {
          rItem = jQuery.extend(true, rItem, change.params);
        });
      }
      return rItem;
    });
  },

  onAssignTo(changeId, itemId, data) {
    this.addStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(changeId, itemId, error) {
    this.clearStatus(itemId, 'assignTo');
    AlertActions.addAlert(ERR_CHANGE_ASSIGNEE, 'error');
  },

  onAssignToSuccess(changeId, itemId, response) {
    var item = this.get(itemId);
    if (!item) {
      return;
    }
    item.assignedTo = response.assignedTo;
    this.clearStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  onDelete(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'delete');
    });
    this.trigger(new Set(itemIds));
  },

  onDeleteError(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'delete');
    });
    AlertActions.addAlert(ERR_SCHEDULE_DELETE, 'error');
    this.trigger(new Set(itemIds));
  },

  onDeleteSuccess(changeId, itemIds, response) {
    var itemIdSet = new Set(itemIds);
    itemIds.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter((item) => !itemIdSet.has(item.id));
    AlertActions.addAlert(OK_SCHEDULE_DELETE, 'success');
    this.trigger(new Set(itemIds));
  },

  onMerge(changeId, itemIds) {
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'merge');
    });
    this.trigger(new Set(itemIds));
  },

  onMergeError(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    AlertActions.addAlert(ERR_SCHEDULE_MERGE, 'error');
    this.trigger(new Set(itemIds));
  },

  onMergeSuccess(changeId, itemIds, response) {
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
    this.trigger(new Set(itemIds));
  },

  onUpdate(changeId, itemIds, data) {
    if (typeof itemIds === 'undefined') this.items.map(item => item.id);
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'update');
      this.pendingChanges.push(changeId, itemId, data);
    });
    this.trigger(new Set(itemIds));
  },

  onUpdateError(changeId, itemIds, error, failSilently) {
    this.pendingChanges.remove(changeId);
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'update');
    });
    if (failSilently) {
      AlertActions.addAlert(ERR_UPDATE, 'error');
    }
    this.trigger(new Set(itemIds));
  },

  onUpdateSuccess(changeId, itemIds, response) {
    if (typeof itemIds === 'undefined') {
      itemIds = this.items.map(item => item.id);
    }
    this.items.forEach((item, idx) => {
      if (itemIds.indexOf(item.id) !== -1) {
        this.items[idx] = jQuery.extend(true, {}, item, response);
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.remove(changeId);
    this.trigger(new Set(itemIds));
  }
});

export default GroupStore;

