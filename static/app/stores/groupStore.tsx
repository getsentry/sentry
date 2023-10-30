import {createStore} from 'reflux';

import {Indicator} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {Activity, BaseGroup, Group, GroupStats} from 'sentry/types';
import RequestError from 'sentry/utils/requestError/requestError';
import toArray from 'sentry/utils/toArray';

import SelectedGroupStore from './selectedGroupStore';
import {CommonStoreDefinition} from './types';

function showAlert(msg: string, type: Indicator['type']) {
  IndicatorStore.addMessage(msg, type, {duration: 4000});
}

type ChangeId = string;

type Change = {
  data: any;
  itemIds: string[];
};

type Item = BaseGroup | Group;

type ItemIds = string[] | undefined;

interface InternalDefinition {
  addActivity: (groupId: string, data: Activity, index?: number) => void;
  indexOfActivity: (groupId: string, id: string) => number;
  items: Item[];

  pendingChanges: Map<ChangeId, Change>;
  removeActivity: (groupId: string, id: string) => number;
  statuses: Record<string, Record<string, boolean>>;
  updateActivity: (groupId: string, id: string, data: Partial<Activity['data']>) => void;
  updateItems: (itemIds: ItemIds) => void;
}

interface GroupStoreDefinition extends CommonStoreDefinition<Item[]>, InternalDefinition {
  add: (items: Item[]) => void;
  addStatus: (id: string, status: string) => void;
  addToFront: (items: Item[]) => void;
  clearStatus: (id: string, status: string) => void;

  get: (id: string) => Item | undefined;
  getAllItemIds: () => string[];
  getAllItems: () => Item[];

  hasStatus: (id: string, status: string) => boolean;
  init: () => void;

  itemIdsOrAll(itemIds: ItemIds): string[];

  loadInitialData: (items: Item[]) => void;

  onAssignTo: (changeId: string, itemId: string, data: any) => void;
  onAssignToError: (changeId: string, itemId: string, error: RequestError) => void;
  onAssignToSuccess: (changeId: string, itemId: string, response: any) => void;

  onDelete: (changeId: string, itemIds: ItemIds) => void;
  onDeleteError: (changeId: string, itemIds: ItemIds, error: Error) => void;
  onDeleteSuccess: (changeId: string, itemIds: ItemIds, response: any) => void;

  onDiscard: (changeId: string, itemId: string) => void;
  onDiscardError: (changeId: string, itemId: string, response: any) => void;
  onDiscardSuccess: (changeId: string, itemId: string, response: any) => void;

  onMerge: (changeId: string, itemIds: ItemIds) => void;
  onMergeError: (changeId: string, itemIds: ItemIds, response: any) => void;
  onMergeSuccess: (changeId: string, itemIds: ItemIds, response: any) => void;

  onPopulateStats: (itemIds: ItemIds, response: GroupStats[]) => void;

  onUpdate: (changeId: string, itemIds: ItemIds, data: any) => void;
  onUpdateError: (changeId: string, itemIds: ItemIds, silent: boolean) => void;
  onUpdateSuccess: (changeId: string, itemIds: ItemIds, response: Partial<Group>) => void;

  remove: (itemIds: ItemIds) => void;

  reset: () => void;
}

const storeConfig: GroupStoreDefinition = {
  pendingChanges: new Map(),
  items: [],
  statuses: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.pendingChanges = new Map();
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

  updateItems(itemIds: ItemIds) {
    const idSet = new Set(itemIds);
    this.trigger(idSet);
    SelectedGroupStore.onGroupChange(idSet);
  },

  mergeItems(items: Item[]) {
    const itemsById = items.reduce((acc, item) => ({...acc, [item.id]: item}), {});

    // Merge these items into the store and return a mapping of any that aren't already in the store
    this.items.forEach((item, itemIndex) => {
      if (itemsById[item.id]) {
        this.items[itemIndex] = {
          ...item,
          ...itemsById[item.id],
        };
        delete itemsById[item.id];
      }
    });

    return items.filter(item => itemsById.hasOwnProperty(item.id));
  },

  /**
   * Adds the provided items to the end of the list.
   * If any items already exist, they will merged into the existing item index.
   */
  add(items) {
    items = toArray(items);
    const newItems = this.mergeItems(items);

    this.items = [...this.items, ...newItems];

    this.updateItems(items.map(item => item.id));
  },

  /**
   * Adds the provided items to the front of the list.
   * If any items already exist, they will be moved to the front in the order provided.
   */
  addToFront(items) {
    items = toArray(items);
    const itemMap = items.reduce((acc, item) => ({...acc, [item.id]: item}), {});

    this.items = [...items, ...this.items.filter(item => !itemMap[item.id])];

    this.updateItems(items.map(item => item.id));
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  itemIdsOrAll(itemIds: ItemIds) {
    return itemIds === undefined ? this.getAllItemIds() : itemIds;
  },

  remove(itemIds) {
    this.items = this.items.filter(item => !itemIds?.includes(item.id));

    this.updateItems(itemIds);
  },

  addStatus(id, status) {
    if (this.statuses[id] === undefined) {
      this.statuses[id] = {};
    }
    this.statuses[id][status] = true;
  },

  clearStatus(id, status) {
    if (this.statuses[id] === undefined) {
      return;
    }
    this.statuses[id][status] = false;
  },

  hasStatus(id, status) {
    return this.statuses[id]?.[status] || false;
  },

  indexOfActivity(groupId, id) {
    const group = this.get(groupId);
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

    this.updateItems([id]);
  },

  updateActivity(groupId, id, data) {
    const group = this.get(groupId);
    if (!group) {
      return;
    }

    const index = this.indexOfActivity(groupId, id);
    if (index === -1) {
      return;
    }

    // Here, we want to merge the new `data` being passed in
    // into the existing `data` object. This effectively
    // allows passing in an object of only changes.
    group.activity[index].data = Object.assign(group.activity[index].data, data);
    this.updateItems([group.id]);
  },

  removeActivity(groupId, id) {
    const group = this.get(groupId);
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

    this.updateItems([group.id]);
    return index;
  },

  get(id) {
    return this.getAllItems().find(item => item.id === id);
  },

  getAllItemIds() {
    return this.items.map(item => item.id);
  },

  getAllItems() {
    // Merge pending changes into the existing group items. This gives the
    // apperance of optimistic updates
    const pendingById: Record<string, Change[]> = {};

    this.pendingChanges.forEach(change => {
      change.itemIds.forEach(itemId => {
        const existing = pendingById[itemId] ?? [];
        pendingById[itemId] = [...existing, change];
      });
    });

    // Merge pending changes into the item if it has them
    return this.items.map(item =>
      pendingById[item.id] === undefined
        ? item
        : {
            ...item,
            ...pendingById[item.id].reduce((a, change) => ({...a, ...change.data}), {}),
          }
    );
  },

  getState() {
    return this.getAllItems();
  },

  onAssignTo(_changeId, itemId, _data) {
    this.addStatus(itemId, 'assignTo');
    this.updateItems([itemId]);
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(_changeId, itemId, error) {
    this.clearStatus(itemId, 'assignTo');
    if (error.responseJSON?.detail === 'Cannot assign to non-team member') {
      showAlert(t('Cannot assign to non-team member'), 'error');
    } else {
      showAlert(t('Unable to change assignee. Please try again.'), 'error');
    }
  },

  onAssignToSuccess(_changeId, itemId, response) {
    const idx = this.items.findIndex(i => i.id === itemId);
    if (idx === -1) {
      return;
    }

    this.items[idx] = {...this.items[idx], assignedTo: response.assignedTo};
    this.clearStatus(itemId, 'assignTo');
    this.updateItems([itemId]);
  },

  onDelete(_changeId, itemIds) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.addStatus(itemId, 'delete'));
    this.updateItems(ids);
  },

  onDeleteError(_changeId, itemIds, _response) {
    showAlert(t('Unable to delete events. Please try again.'), 'error');

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => this.clearStatus(itemId, 'delete'));
    this.updateItems(itemIds);
  },

  onDeleteSuccess(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    if (ids.length > 1) {
      showAlert(t('Deleted %d Issues', ids.length), 'success');
    } else {
      const shortId = ids.map(item => GroupStore.get(item)?.shortId).join('');
      showAlert(t('Deleted %s', shortId), 'success');
    }

    const itemIdSet = new Set(ids);
    ids.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter(item => !itemIdSet.has(item.id));
    this.updateItems(ids);
  },

  onDiscard(_changeId, itemId) {
    this.addStatus(itemId, 'discard');
    this.updateItems([itemId]);
  },

  onDiscardError(_changeId, itemId, _response) {
    this.clearStatus(itemId, 'discard');
    showAlert(t('Unable to discard event. Please try again.'), 'error');
    this.updateItems([itemId]);
  },

  onDiscardSuccess(_changeId, itemId, _response) {
    delete this.statuses[itemId];
    this.clearStatus(itemId, 'discard');
    this.items = this.items.filter(item => item.id !== itemId);
    showAlert(t('Similar events will be filtered and discarded.'), 'success');
    this.updateItems([itemId]);
  },

  onMerge(_changeId, itemIds) {
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => this.addStatus(itemId, 'merge'));
    // XXX(billy): Not sure if this is a bug or not but do we need to publish all itemIds?
    // Seems like we only need to publish parent id
    this.updateItems(ids);
  },

  onMergeError(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => this.clearStatus(itemId, 'merge'));
    showAlert(t('Unable to merge events. Please try again.'), 'error');
    this.updateItems(ids);
  },

  onMergeSuccess(_changeId, itemIds, response) {
    const ids = this.itemIdsOrAll(itemIds); // everything on page

    ids.forEach(itemId => this.clearStatus(itemId, 'merge'));

    // Remove all but parent id (items were merged into this one)
    const mergedIdSet = new Set(ids);

    // Looks like the `PUT /api/0/projects/:orgId/:projectId/issues/` endpoint
    // actually returns a 204, so there is no `response` body
    this.items = this.items.filter(
      item =>
        !mergedIdSet.has(item.id) ||
        (response && response.merge && item.id === response.merge.parent)
    );

    if (ids.length > 0) {
      showAlert(t('Merged %d Issues', ids.length), 'success');
    }

    this.updateItems(ids);
  },

  onUpdate(changeId, itemIds, data) {
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => {
      this.addStatus(itemId, 'update');
    });
    this.pendingChanges.set(changeId, {itemIds: ids, data});

    this.updateItems(ids);
  },

  onUpdateError(changeId, itemIds, failSilently) {
    const ids = this.itemIdsOrAll(itemIds);

    this.pendingChanges.delete(changeId);
    ids.forEach(itemId => this.clearStatus(itemId, 'update'));

    if (!failSilently) {
      showAlert(t('Unable to update events. Please try again.'), 'error');
    }

    this.updateItems(ids);
  },

  onUpdateSuccess(changeId, itemIds, response) {
    const ids = this.itemIdsOrAll(itemIds);

    this.items.forEach((item, idx) => {
      if (ids.includes(item.id)) {
        this.items[idx] = {
          ...item,
          ...response,
        };
        this.clearStatus(item.id, 'update');
      }
    });
    this.pendingChanges.delete(changeId);
    this.updateItems(ids);
  },

  onPopulateStats(itemIds, response) {
    // Organize stats by id
    const groupStatsMap = response.reduce<Record<string, GroupStats>>(
      (map, stats) => ({...map, [stats.id]: stats}),
      {}
    );

    this.items.forEach((item, idx) => {
      if (itemIds?.includes(item.id)) {
        this.items[idx] = {
          ...item,
          ...groupStatsMap[item.id],
        };
      }
    });
    this.updateItems(itemIds);
  },
};

const GroupStore = createStore(storeConfig);
export default GroupStore;
