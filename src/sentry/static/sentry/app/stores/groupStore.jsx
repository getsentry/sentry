import jQuery from "jquery";
import Reflux from "reflux";
import AlertActions from "../actions/alertActions";
import GroupActions from '../actions/groupActions';
import utils from "../utils";

var ERR_CHANGE_ASSIGNEE = 'Unable to change assignee. Please try again.';
var ERR_SCHEDULE_DELETE = 'Unable to delete events. Please try again.';
var ERR_SCHEDULE_MERGE = 'Unable to merge events. Please try again.';
var ERR_UPDATE = 'Unable to update events. Please try again.';
var OK_SCHEDULE_DELETE = 'The selected events have been scheduled for deletion.';
var OK_SCHEDULE_MERGE = 'The selected events have been scheduled for merge.';

var GroupStore = Reflux.createStore({
  listenables: [GroupActions],

  init() {
    this.items = [];
    this.statuses = {};
    this.pendingChanges = new utils.PendingChangeQueue();
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

  indexOfActivity(group_id, id) {
    var group = this.get(group_id);
    if (!group) return -1;

    for (var i = 0; i < group.activity.length; i++) {
      if (group.activity[i].id === id) {
        return i;
      }
    }
    return -1;
  },

  addActivity(id, data, index=-1) {
    var group = this.get(id);
    if (!group) return;

    // insert into beginning by default
    if (index === -1) {
      group.activity.unshift(data);
    } else {
      group.activity.splice(index, 0, data);
    }
    if (data.type === 'note')
      group.numComments++;

    this.trigger(new Set([id]));
  },

  updateActivity(group_id, id, data) {
    var group = this.get(group_id);
    if (!group) return;

    var index = this.indexOfActivity(group_id, id);
    if (index === -1) return;

    // Here, we want to merge the new `data` being passed in
    // into the existing `data` object. This effectively
    // allows passing in an object of only changes.
    group.activity[index].data = Object.assign(group.activity[index].data, data);
    this.trigger(new Set([group.id]));
  },

  removeActivity(group_id, id) {
    var group = this.get(group_id);
    if (!group) return -1;

    var index = this.indexOfActivity(group.id, id);
    if (index === -1) return -1;

    var activity = group.activity.splice(index, 1);

    if (activity[0].type === 'note')
      group.numComments--;

    this.trigger(new Set([group.id]));
    return index;
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

  onMergeSuccess(changeId, mergedIds, response) {
    mergedIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });

    // Remove all but parent id (items were merged into this one)
    var mergedIdSet = new Set(mergedIds);
    this.items = this.items.filter(
      (item) => !mergedIdSet.has(item.id) || item.id === response.merge.parent
    );

    AlertActions.addAlert(OK_SCHEDULE_MERGE, 'success');
    this.trigger(new Set(mergedIds));
  },

  onUpdate(changeId, itemIds, data) {
    if (typeof itemIds === 'undefined') {
      itemIds = this.items.map(item => item.id);
    }
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
    if (!failSilently) {
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
