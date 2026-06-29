import {createStore} from 'reflux';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {IndicatorStore} from 'sentry/stores/indicatorStore';
import type {BaseGroup, Group, GroupStats} from 'sentry/types/group';
import {toArray} from 'sentry/utils/array/toArray';
import {parseApiError} from 'sentry/utils/parseApiError';
import type {RequestError} from 'sentry/utils/requestError/requestError';

import type {StrictStoreDefinition} from './types';

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
  /**
   * Does not include pending changes
   * TODO: Remove mutation and replace state with items
   */
  items: Item[];

  pendingChanges: Map<ChangeId, Change>;
  statuses: Record<string, Record<string, boolean>>;
  updateItems: (itemIds: ItemIds) => void;
}

interface GroupStoreDefinition extends StrictStoreDefinition<Item[]>, InternalDefinition {
  add: (items: Item[]) => void;
  addStatus: (id: string, status: string) => void;
  addToFront: (items: Item[]) => void;
  clearStatus: (id: string, status: string) => void;

  get: (id: string) => Readonly<Item> | undefined;
  getAllItemIds: () => string[];
  getAllItems: () => readonly Item[];

  hasStatus: (id: string, status: string) => boolean;
  init: () => void;

  itemIdsOrAll(itemIds: ItemIds): string[];

  loadInitialData: (items: Item[]) => void;

  mergeItems: (items: Item[]) => Item[];

  onAssignTo: (changeId: string, itemId: string, data: any) => void;
  onAssignToError: (changeId: string, itemId: string, error: RequestError) => void;
  onAssignToSuccess: (changeId: string, itemId: string, response: any) => void;

  onDelete: (changeId: string, itemIds: ItemIds) => void;
  onDeleteError: (changeId: string, itemIds: ItemIds, response: RequestError) => void;
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

function mergePendingChanges(
  items: readonly Item[],
  pendingChanges: Map<ChangeId, Change>
): readonly Item[] {
  // Merge pending changes into the existing group items. This gives the
  // appearance of optimistic updates
  const pendingById: Record<string, Change[]> = {};

  pendingChanges.forEach(change => {
    change.itemIds.forEach(itemId => {
      const existing = pendingById[itemId] ?? [];
      pendingById[itemId] = [...existing, change];
    });
  });

  // Merge pending changes into the item if it has them
  return items.map(item =>
    pendingById[item.id] === undefined
      ? item
      : {
          ...item,
          ...pendingById[item.id]!.reduce((a, change) => ({...a, ...change.data}), {}),
        }
  );
}

const storeConfig: GroupStoreDefinition = {
  pendingChanges: new Map(),
  items: [],
  state: [],
  statuses: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.pendingChanges = new Map();
    this.items = [];
    this.state = [];
    this.statuses = {};
  },

  loadInitialData(items) {
    this.reset();

    const itemIds = items.map(item => item.id);
    this.items = [...this.items, ...items];

    this.updateItems(itemIds);
  },

  updateItems(itemIds: ItemIds) {
    const idSet = new Set(itemIds);
    this.state = mergePendingChanges(this.items, this.pendingChanges);
    this.trigger(idSet);
  },

  mergeItems(items: Item[]) {
    const itemsById = items.reduce<Record<string, Item>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

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

    return items.filter(item => Object.hasOwn(itemsById, item.id));
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
    const itemMap = items.reduce<Record<string, Item>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

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

  get(id) {
    return this.getAllItems().find(item => item.id === id);
  },

  getAllItemIds() {
    return this.items.map(item => item.id);
  },

  getAllItems() {
    return this.state;
  },

  getState() {
    return this.state;
  },

  onAssignTo(_changeId, itemId, _data) {
    this.addStatus(itemId, 'assignTo');
    this.updateItems([itemId]);
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(_changeId, itemId, error) {
    this.clearStatus(itemId, 'assignTo');
    const assignedToError = error.responseJSON?.assignedTo;
    if (Array.isArray(assignedToError) && assignedToError.length > 0) {
      showAlert(assignedToError[0], 'error');
    } else if (typeof assignedToError === 'string') {
      showAlert(assignedToError, 'error');
    } else if (error.responseJSON?.detail) {
      showAlert(parseApiError(error), 'error');
    } else {
      showAlert(t('Unable to change assignee. Please try again.'), 'error');
    }
  },

  onAssignToSuccess(_changeId, itemId, response) {
    const idx = this.items.findIndex(i => i.id === itemId);
    if (idx === -1) {
      return;
    }

    this.items[idx] = {...this.items[idx]!, assignedTo: response.assignedTo};
    this.clearStatus(itemId, 'assignTo');
    this.updateItems([itemId]);
  },

  onDelete(_changeId, itemIds) {
    const ids = this.itemIdsOrAll(itemIds);
    ids.forEach(itemId => this.addStatus(itemId, 'delete'));
    this.updateItems(ids);
  },

  onDeleteError(_changeId, itemIds, response) {
    if (response.status === 403) {
      showAlert(t('You do not have permission to delete issues'), 'error');
    } else {
      showAlert(t('Unable to delete events. Please try again.'), 'error');
    }

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => this.clearStatus(itemId, 'delete'));
    this.updateItems(itemIds);
  },

  onDeleteSuccess(_changeId, itemIds, _response) {
    const ids = this.itemIdsOrAll(itemIds);

    if (itemIds === undefined) {
      showAlert(t('Deleted selected issues'), 'success');
    } else if (ids.length > 1) {
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
      item => !mergedIdSet.has(item.id) || item.id === response?.merge?.parent
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
    const groupStatsMap = response.reduce<Record<string, GroupStats>>((map, stats) => {
      map[stats.id] = stats;
      return map;
    }, {});

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

export const GroupStore = createStore(storeConfig);
