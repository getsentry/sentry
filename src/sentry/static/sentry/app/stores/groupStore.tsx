import isArray from 'lodash/isArray';
import isUndefined from 'lodash/isUndefined';
import Reflux from 'reflux';

import {Activity, Group} from 'app/types';
import GroupActions from 'app/actions/groupActions';
import IndicatorStore from 'app/stores/indicatorStore';
import {t} from 'app/locale';

function showAlert(msg, type) {
  IndicatorStore.addMessage(msg, type, {
    duration: 4000,
  });
}

// TODO(ts) Type this any better.
type Change = [string, string, any];

class PendingChangeQueue {
  changes: Change[] = [];

  getForItem(itemId: string) {
    return this.changes.filter((change: Change) => change[1] === itemId);
  }

  push(changeId: string, itemId: string, data: any) {
    this.changes.push([changeId, itemId, data]);
  }

  remove(changeId: string, itemId?: string) {
    this.changes = this.changes.filter(
      change => change[0] !== changeId || change[1] !== itemId
    );
  }

  forEach(...args: any[]) {
    this.changes.forEach.apply(this.changes, args);
  }
}

type State = {
  items: any[];
  statuses: Record<string, any[]>;
};

type Internals = {
  state: State;
  pendingChanges: PendingChangeQueue;

  indexOfActivity: (groupId: string, id: string) => number;
  addActivity: (groupId: string, data: Activity, index?: number) => void;
  updateActivity: (groupId: string, id: string, data: Partial<Activity>) => void;
  removeActivity: (groupId: string, id: string) => number;
};

type GroupStoreInterface = Reflux.StoreDefinition & {
  init: () => void;
  reset: () => void;
  loadInitialData: (items: Group[]) => void;
  add: (items: Group[]) => void;
  remove: (itemId: string) => void;
  addStatus: (id: string, status: string) => void;
  clearStatus: (id: string, status: string) => void;
  hasStatus: (id: string, status: string) => boolean;
  get: (id: string) => Group | undefined;
  getAllItemIds: () => string[];
  getAllItems: () => Group[];
  onAssignTo: (changeId: string, itemId: string, data: any) => void;
  onAssignToError: (changeId: string, itemId: string, error: Error) => void;
  onAssignToSuccess: (changeId: string, itemId: string, response: any) => void;
  onDelete: (changeId: string, itemIds: string[]) => void;
  onDeleteSuccess: (changeId: string, itemIds: string[], response: any) => void;
  onDeleteError: (changeId: string, itemIds: string[], error: Error) => void;
  onDiscard: (changeId: string, itemId: string) => void;
  onDiscardError: (changeId: string, itemId: string, response: any) => void;
  onDiscardSuccess: (changeId: string, itemId: string, response: any) => void;
  onMerge: (changeId: string, itemIds: string[]) => void;
  onMergeError: (changeId: string, itemIds: string[], response: any) => void;
  onMergeSuccess: (changeId: string, itemIds: string[], response: any) => void;
  onUpdate: (changeId: string, itemIds: string[], data: any) => void;
  onUpdateSuccess: (
    changeId: string,
    itemIds: string[],
    response: Partial<Group>
  ) => void;
  onUpdateError: (
    changeId: string,
    itemIds: string[],
    error: Error,
    silent: boolean
  ) => void;
};

type GroupStore = Reflux.Store & GroupStoreInterface;

const storeConfig: Reflux.StoreDefinition & Internals & GroupStoreInterface = {
  listenables: [GroupActions],

  state: {
    items: [],
    statuses: {},
  },

  pendingChanges: new PendingChangeQueue(),

  init() {
    this.reset();
  },

  reset() {
    this.pendingChanges = new PendingChangeQueue();
    this.items = [];
    this.statuses = {};
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.reset();

    const itemIds = new Set<string>();
    items.forEach(item => {
      itemIds.add(item.id);
      this.items.push(item);
    });

    this.trigger(itemIds);
  },

  add(items) {
    if (!isArray(items)) {
      items = [items];
    }

    const itemsById = {};
    const itemIds = new Set<string>();
    items.forEach(item => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    });

    // See if any existing items are updated by this new set of items
    this.items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = {
          ...item,
          ...itemsById[item.id],
        };
        delete itemsById[item.id];
      }
    });

    // New items
    for (const itemId in itemsById) {
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
    if (isUndefined(this.statuses[id])) {
      this.statuses[id] = {};
    }
    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (isUndefined(this.statuses[id])) {
      return;
    }
    this.statuses[id][status] = false;
  },

  hasStatus(id, status) {
    if (isUndefined(this.statuses[id])) {
      return false;
    }
    return this.statuses[id][status] || false;
  },

  indexOfActivity(group_id, id) {
    const group = this.get(group_id);
    if (!group) {
      return -1;
    }

    for (let i = 0; i < group.activity.length; i++) {
      if (group.activity[i].id === id) {
        return i;
      }
    }
    return -1;
  },

  addActivity(id, data, index = -1) {
    const group = this.get(id);
    if (!group) {
      return;
    }

    // insert into beginning by default
    if (index === -1) {
      group.activity.unshift(data);
    } else {
      group.activity.splice(index, 0, data);
    }
    if (data.type === 'note') {
      group.numComments++;
    }

    this.trigger(new Set([id]));
  },

  updateActivity(group_id, id, data) {
    const group = this.get(group_id);
    if (!group) {
      return;
    }

    const index = this.indexOfActivity(group_id, id);
    if (index === -1) {
      return;
    }

    // Here, we want to merge the new `data` being passed in
    // into the existing `data` object. This effectively
    // allows passing in an object of only changes.
    group.activity[index].data = Object.assign(group.activity[index].data, data);
    this.trigger(new Set([group.id]));
  },

  removeActivity(group_id, id) {
    const group = this.get(group_id);
    if (!group) {
      return -1;
    }

    const index = this.indexOfActivity(group.id, id);
    if (index === -1) {
      return -1;
    }

    const activity = group.activity.splice(index, 1);

    if (activity[0].type === 'note') {
      group.numComments--;
    }

    this.trigger(new Set([group.id]));
    return index;
  },

  get(id) {
    // TODO(ts) This needs to be constrained further. It was left as any
    // because the PendingChanges signatures and this were not aligned.
    const pendingForId: any[] = [];
    this.pendingChanges.forEach((change: any) => {
      if (change.id === id) {
        pendingForId.push(change);
      }
    });

    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        let rItem = this.items[i];
        if (pendingForId.length) {
          // copy the object so dirty state doesnt mutate original
          rItem = {...rItem};

          for (let c = 0; c < pendingForId.length; c++) {
            rItem = {
              ...rItem,
              ...pendingForId[c].params,
            };
          }
        }
        return rItem;
      }
    }
    return undefined;
  },

  getAllItemIds() {
    return this.items.map(item => item.id);
  },

  getAllItems() {
    // regroup pending changes by their itemID
    const pendingById = {};
    this.pendingChanges.forEach(change => {
      if (isUndefined(pendingById[change.id])) {
        pendingById[change.id] = [];
      }
      pendingById[change.id].push(change);
    });

    return this.items.map(item => {
      let rItem = item;
      if (!isUndefined(pendingById[item.id])) {
        // copy the object so dirty state doesnt mutate original
        rItem = {...rItem};
        pendingById[item.id].forEach(change => {
          rItem = {
            ...rItem,
            ...change.params,
          };
        });
      }
      return rItem;
    });
  },

  onAssignTo(_changeId, itemId, _data) {
    this.addStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(_changeId, itemId, _error) {
    this.clearStatus(itemId, 'assignTo');
    showAlert(t('Unable to change assignee. Please try again.'), 'error');
  },

  onAssignToSuccess(_changeId, itemId, response) {
    const item = this.get(itemId);
    if (!item) {
      return;
    }
    item.assignedTo = response.assignedTo;
    this.clearStatus(itemId, 'assignTo');
    this.trigger(new Set([itemId]));
  },

  onDelete(_changeId, itemIds) {
    itemIds = this._itemIdsOrAll(itemIds);
    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'delete');
    });
    this.trigger(new Set(itemIds));
  },

  onDeleteError(_changeId, itemIds, _response) {
    showAlert(t('Unable to delete events. Please try again.'), 'error');

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'delete');
    });
    this.trigger(new Set(itemIds));
  },

  onDeleteSuccess(_changeId, itemIds, _response) {
    itemIds = this._itemIdsOrAll(itemIds);
    const itemIdSet = new Set(itemIds);
    itemIds.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter(item => !itemIdSet.has(item.id));
    showAlert(t('The selected events have been scheduled for deletion.'), 'success');
    this.trigger(new Set(itemIds));
  },

  onDiscard(_changeId, itemId) {
    this.addStatus(itemId, 'discard');
    this.trigger(new Set([itemId]));
  },

  onDiscardError(_changeId, itemId, _response) {
    this.clearStatus(itemId, 'discard');
    showAlert(t('Unable to discard event. Please try again.'), 'error');
    this.trigger(new Set([itemId]));
  },

  onDiscardSuccess(_changeId, itemId, _response) {
    delete this.statuses[itemId];
    this.clearStatus(itemId, 'discard');
    this.items = this.items.filter(item => item.id !== itemId);
    showAlert(t('Similar events will be filtered and discarded.'), 'success');
    this.trigger(new Set([itemId]));
  },

  onMerge(_changeId, itemIds) {
    itemIds = this._itemIdsOrAll(itemIds);

    itemIds.forEach(itemId => {
      this.addStatus(itemId, 'merge');
    });
    // XXX(billy): Not sure if this is a bug or not but do we need to publish all itemIds?
    // Seems like we only need to publish parent id
    this.trigger(new Set(itemIds));
  },

  onMergeError(_changeId, itemIds, _response) {
    itemIds = this._itemIdsOrAll(itemIds);

    itemIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });
    showAlert(t('Unable to merge events. Please try again.'), 'error');
    this.trigger(new Set(itemIds));
  },

  onMergeSuccess(_changeId, mergedIds, response) {
    mergedIds = this._itemIdsOrAll(mergedIds); // everything on page

    mergedIds.forEach(itemId => {
      this.clearStatus(itemId, 'merge');
    });

    // Remove all but parent id (items were merged into this one)
    const mergedIdSet = new Set(mergedIds);

    // Looks like the `PUT /api/0/projects/:orgId/:projectId/issues/` endpoint
    // actually returns a 204, so there is no `response` body
    this.items = this.items.filter(
      item =>
        !mergedIdSet.has(item.id) ||
        (response && response.merge && item.id === response.merge.parent)
    );

    showAlert(t('The selected events have been scheduled for merge.'), 'success');
    this.trigger(new Set(mergedIds));
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  _itemIdsOrAll(itemIds) {
    if (isUndefined(itemIds)) {
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

  onUpdateError(changeId, itemIds, _error, failSilently) {
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
        this.items[idx] = {
          ...item,
          ...response,
        };
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.remove(changeId);
    this.trigger(new Set(itemIds));
  },
};

export default Reflux.createStore(storeConfig) as GroupStore;
