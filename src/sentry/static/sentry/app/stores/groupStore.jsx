import jQuery from 'jquery';
import Reflux from 'reflux';
import GroupActions from '../actions/groupActions';
import IndicatorStore from '../stores/indicatorStore';
import utils from '../utils';
import {t} from '../locale';


function showAlert(msg, type) {
  IndicatorStore.add(msg, type, {
    duration: 4000
  });
}

const GroupStore = Reflux.createStore({
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

    let itemIds = new Set();
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

    let itemsById = {};
    let itemIds = new Set();
    items.forEach((item) => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    });

    items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = jQuery.extend(true, {}, item, itemsById[item.id]);
        // HACK(dcramer): work around statusDetails not being consistent
        if (typeof itemsById[item.id].statusDetails !== undefined) {
          this.items[idx].statusDetails = itemsById[item.id].statusDetails;
        }
        delete itemsById[item.id];
      }
    });

    for (let itemId in itemsById) {
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
    let group = this.get(group_id);
    if (!group) return -1;

    for (let i = 0; i < group.activity.length; i++) {
      if (group.activity[i].id === id) {
        return i;
      }
    }
    return -1;
  },

  addActivity(id, data, index = -1) {
    let group = this.get(id);
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
    let group = this.get(group_id);
    if (!group) return;

    let index = this.indexOfActivity(group_id, id);
    if (index === -1) return;

    // Here, we want to merge the new `data` being passed in
    // into the existing `data` object. This effectively
    // allows passing in an object of only changes.
    group.activity[index].data = Object.assign(group.activity[index].data, data);
    this.trigger(new Set([group.id]));
  },

  removeActivity(group_id, id) {
    let group = this.get(group_id);
    if (!group) return -1;

    let index = this.indexOfActivity(group.id, id);
    if (index === -1) return -1;

    let activity = group.activity.splice(index, 1);

    if (activity[0].type === 'note')
      group.numComments--;

    this.trigger(new Set([group.id]));
    return index;
  },

  get(id) {
    let pendingForId = [];
    this.pendingChanges.forEach(change => {
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        let rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = jQuery.extend(true, {}, rItem);

          for (let c = 0; c < pendingForId.length; c++) {
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
    let pendingById = {};
    this.pendingChanges.forEach(change => {
      if (typeof pendingById[change.id] === 'undefined') {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    return this.items.map(item => {
      let rItem = item;
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
    showAlert(t('Unable to change assignee. Please try again.'), 'error');
  },

  onAssignToSuccess(changeId, itemId, response) {
    let item = this.get(itemId);
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
    showAlert(t('Unable to delete events. Please try again.'), 'error');
    this.trigger(new Set(itemIds));
  },

  onDeleteSuccess(changeId, itemIds, response) {
    let itemIdSet = new Set(itemIds);
    itemIds.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter((item) => !itemIdSet.has(item.id));
    showAlert(t('The selected events have been scheduled for deletion.'), 'success');
    this.trigger(new Set(itemIds));
  },

  onMerge(changeId, itemIds) {
    itemIds = this._itemIdsOrAll(itemIds);

    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'merge');
    });
    this.trigger(new Set(itemIds));
  },

  onMergeError(changeId, itemIds, response) {
    itemIds = this._itemIdsOrAll(itemIds);

    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    showAlert(t('Unable to merge events. Please try again.'), 'error');
    this.trigger(new Set(itemIds));
  },

  onMergeSuccess(changeId, mergedIds, response) {
    mergedIds = this._itemIdsOrAll(mergedIds); // everything on page

    mergedIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });

    // Remove all but parent id (items were merged into this one)
    let mergedIdSet = new Set(mergedIds);
    this.items = this.items.filter(
      (item) => !mergedIdSet.has(item.id) || item.id === response.merge.parent
    );

    showAlert(t('The selected events have been scheduled for merge.'), 'success');
    this.trigger(new Set(mergedIds));
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  _itemIdsOrAll(itemIds) {
    if (typeof itemIds === 'undefined') {
      itemIds = this.items.map(item => item.id);
    }
    return itemIds;
  },

  onUpdate(changeId, itemIds, data) {
    itemIds = this._itemIdsOrAll(itemIds);

    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'update');
      this.pendingChanges.push(changeId, itemId, data);
    });
    this.trigger(new Set(itemIds));
  },

  onUpdateError(changeId, itemIds, error, failSilently) {
    itemIds = this._itemIdsOrAll(itemIds);

    this.pendingChanges.remove(changeId);
    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'update');
    });
    if (!failSilently) {
      showAlert(t('Unable to update events. Please try again.'), 'error');
    }
    this.trigger(new Set(itemIds));
  },

  onUpdateSuccess(changeId, itemIds, response) {
    itemIds = this._itemIdsOrAll(itemIds);

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
