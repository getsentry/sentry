import isArray from 'lodash/isArray';
import {createStore} from 'reflux';

import {Indicator} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {
  Activity,
  BaseGroup,
  Group,
  GroupCollapseRelease,
  GroupRelease,
  GroupStats,
} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

function showAlert(msg: string, type: Indicator['type']) {
  IndicatorStore.addMessage(msg, type, {duration: 4000});
}

type ChangeId = string;

type Change = {
  data: any;
  itemIds: string[];
};

type Item = BaseGroup | Group | GroupCollapseRelease;

type ItemIds = string[] | undefined;

interface InternalDefinition {
  addActivity: (groupId: string, data: Activity, index?: number) => void;
  indexOfActivity: (groupId: string, id: string) => number;
  items: Item[];

  pendingChanges: Map<ChangeId, Change>;
  removeActivity: (groupId: string, id: string) => number;
  statuses: Record<string, Record<string, boolean>>;
  updateActivity: (groupId: string, id: string, data: Partial<Activity>) => void;
}

interface GroupStoreDefinition extends CommonStoreDefinition<Item[]>, InternalDefinition {
  add: (items: Item[]) => void;
  addStatus: (id: string, status: string) => void;
  clearStatus: (id: string, status: string) => void;

  get: (id: string) => Item | undefined;
  getAllItemIds: () => string[];
  getAllItems: () => Item[];

  hasStatus: (id: string, status: string) => boolean;
  init: () => void;

  itemIdsOrAll(itemIds: ItemIds): string[];

  loadInitialData: (items: Item[]) => void;

  onAssignTo: (changeId: string, itemId: string, data: any) => void;
  onAssignToError: (changeId: string, itemId: string, error: Error) => void;
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

  onPopulateReleases: (itemId: string, releaseData: GroupRelease) => void;
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

  add(items) {
    if (!isArray(items)) {
      items = [items];
    }

    const itemsById: Record<string, Item> = {};
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
    const newItems = items.filter(item => itemsById.hasOwnProperty(item.id));
    this.items = this.items.concat(newItems);

    this.trigger(itemIds);
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  itemIdsOrAll(itemIds: ItemIds) {
    return itemIds === undefined ? this.getAllItemIds() : itemIds;
  },

  remove(itemIds) {
    this.items = this.items.filter(item => !itemIds?.includes(item.id));

    this.trigger(new Set(itemIds));
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

    this.trigger(new Set([id]));
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
    this.trigger(new Set([group.id]));
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

    this.trigger(new Set([group.id]));
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
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.addStatus(itemId, 'delete'));
    this.trigger(new Set(ids));
  },

  onDeleteError(_changeId, itemIds, _response) {
    showAlert(t('Unable to delete events. Please try again.'), 'error');

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => this.clearStatus(itemId, 'delete'));
    this.trigger(new Set(itemIds));
  },

  onDeleteSuccess(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    if (ids.length > 1) {
      showAlert(t(`Deleted ${ids.length} Issues`), 'success');
    } else {
      const shortId = ids.map(item => GroupStore.get(item)?.shortId).join('');
      showAlert(t(`Deleted ${shortId}`), 'success');
    }

    const itemIdSet = new Set(ids);
    ids.forEach(itemId => {
      delete this.statuses[itemId];
      this.clearStatus(itemId, 'delete');
    });
    this.items = this.items.filter(item => !itemIdSet.has(item.id));
    this.trigger(new Set(ids));
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
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => this.addStatus(itemId, 'merge'));
    // XXX(billy): Not sure if this is a bug or not but do we need to publish all itemIds?
    // Seems like we only need to publish parent id
    this.trigger(new Set(ids));
  },

  onMergeError(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => this.clearStatus(itemId, 'merge'));
    showAlert(t('Unable to merge events. Please try again.'), 'error');
    this.trigger(new Set(ids));
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
      showAlert(t(`Merged ${ids.length} Issues`), 'success');
    }

    this.trigger(new Set(ids));
  },

  onUpdate(changeId, itemIds, data) {
    const ids = this.itemIdsOrAll(itemIds);

    ids.forEach(itemId => {
      this.addStatus(itemId, 'update');
    });
    this.pendingChanges.set(changeId, {itemIds: ids, data});

    this.trigger(new Set(ids));
  },

  onUpdateError(changeId, itemIds, failSilently) {
    const ids = this.itemIdsOrAll(itemIds);

    this.pendingChanges.delete(changeId);
    ids.forEach(itemId => this.clearStatus(itemId, 'update'));

    if (!failSilently) {
      showAlert(t('Unable to update events. Please try again.'), 'error');
    }

    this.trigger(new Set(ids));
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
    this.trigger(new Set(ids));
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
    this.trigger(new Set(itemIds));
  },

  onPopulateReleases(itemId, releaseData) {
    this.items.forEach((item, idx) => {
      if (item.id === itemId) {
        this.items[idx] = {
          ...item,
          ...releaseData,
        };
      }
    });
    this.trigger(new Set([itemId]));
  },
};

const GroupStore = createStore(makeSafeRefluxStore(storeConfig));
export default GroupStore;
