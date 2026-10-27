import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {createLegacyStore} from 'sentry/stores/createLegacyStore';
import type {BaseGroup, Group, GroupStats} from 'sentry/types/group';
import {toArray} from 'sentry/utils/array/toArray';
import {parseApiError} from 'sentry/utils/parseApiError';
import type {RequestError} from 'sentry/utils/requestError/requestError';

function showAlert(msg: string, type: 'error' | 'success') {
  toast[type](msg, {duration: 4000});
}

type ChangeId = string;

type Change = {
  data: any;
  itemIds: string[];
};

type Item = BaseGroup | Group;

type ItemIds = string[] | undefined;

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

const store = createLegacyStore<readonly Item[]>([]);

export const GroupStore = {
  ...store,
  /**
   * Does not include pending changes
   * TODO: Remove mutation and replace state with items
   */
  items: [] as Item[],
  pendingChanges: new Map<ChangeId, Change>(),
  statuses: {} as Record<string, Record<string, boolean>>,

  init() {
    GroupStore.reset();
  },

  reset() {
    GroupStore.pendingChanges = new Map();
    GroupStore.items = [];
    GroupStore.statuses = {};
    store.resetState([]);
  },

  loadInitialData(items: Item[]) {
    GroupStore.reset();

    GroupStore.items = [...GroupStore.items, ...items];

    GroupStore.updateItems();
  },

  updateItems() {
    store.setState(() =>
      mergePendingChanges(GroupStore.items, GroupStore.pendingChanges)
    );
  },

  mergeItems(items: Item[]) {
    const itemsById = items.reduce<Record<string, Item>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    // Merge these items into the store and return a mapping of any that aren't already in the store
    GroupStore.items.forEach((item, itemIndex) => {
      if (itemsById[item.id]) {
        GroupStore.items[itemIndex] = {
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
  add(items: Item[]) {
    items = toArray(items);
    const newItems = GroupStore.mergeItems(items);

    GroupStore.items = [...GroupStore.items, ...newItems];

    GroupStore.updateItems();
  },

  /**
   * Adds the provided items to the front of the list.
   * If any items already exist, they will be moved to the front in the order provided.
   */
  addToFront(items: Item[]) {
    items = toArray(items);
    const itemMap = items.reduce<Record<string, Item>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    GroupStore.items = [...items, ...GroupStore.items.filter(item => !itemMap[item.id])];

    GroupStore.updateItems();
  },

  /**
   * If itemIds is undefined, returns all ids in the store
   */
  itemIdsOrAll(itemIds: ItemIds): string[] {
    return itemIds === undefined ? GroupStore.getAllItemIds() : itemIds;
  },

  remove(itemIds: ItemIds) {
    GroupStore.items = GroupStore.items.filter(item => !itemIds?.includes(item.id));

    GroupStore.updateItems();
  },

  addStatus(id: string, status: string) {
    if (GroupStore.statuses[id] === undefined) {
      GroupStore.statuses[id] = {};
    }
    GroupStore.statuses[id][status] = true;
  },

  clearStatus(id: string, status: string) {
    if (GroupStore.statuses[id] === undefined) {
      return;
    }
    GroupStore.statuses[id][status] = false;
  },

  hasStatus(id: string, status: string): boolean {
    return GroupStore.statuses[id]?.[status] || false;
  },

  get(id: string): Readonly<Item> | undefined {
    return GroupStore.getAllItems().find(item => item.id === id);
  },

  getAllItemIds(): string[] {
    return GroupStore.items.map(item => item.id);
  },

  getAllItems(): readonly Item[] {
    return store.getState();
  },

  onAssignTo(_changeId: string, itemId: string, _data: any) {
    GroupStore.addStatus(itemId, 'assignTo');
    GroupStore.updateItems();
  },

  // TODO(dcramer): This is not really the best place for this
  onAssignToError(_changeId: string, itemId: string, error: RequestError) {
    GroupStore.clearStatus(itemId, 'assignTo');
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

  onAssignToSuccess(_changeId: string, itemId: string, response: any) {
    const idx = GroupStore.items.findIndex(i => i.id === itemId);
    if (idx === -1) {
      return;
    }

    GroupStore.items[idx] = {...GroupStore.items[idx]!, assignedTo: response.assignedTo};
    GroupStore.clearStatus(itemId, 'assignTo');
    GroupStore.updateItems();
  },

  onDelete(_changeId: string, itemIds: ItemIds) {
    const ids = GroupStore.itemIdsOrAll(itemIds);
    ids.forEach(itemId => GroupStore.addStatus(itemId, 'delete'));
    GroupStore.updateItems();
  },

  onDeleteError(_changeId: string, itemIds: ItemIds, response: RequestError) {
    if (response.status === 403) {
      showAlert(t('You do not have permission to delete issues'), 'error');
    } else {
      showAlert(t('Unable to delete events. Please try again.'), 'error');
    }

    if (!itemIds) {
      return;
    }

    itemIds.forEach(itemId => GroupStore.clearStatus(itemId, 'delete'));
    GroupStore.updateItems();
  },

  onDeleteSuccess(_changeId: string, itemIds: ItemIds, _response: any) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

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
      delete GroupStore.statuses[itemId];
      GroupStore.clearStatus(itemId, 'delete');
    });
    GroupStore.items = GroupStore.items.filter(item => !itemIdSet.has(item.id));
    GroupStore.updateItems();
  },

  onDiscard(_changeId: string, itemId: string) {
    GroupStore.addStatus(itemId, 'discard');
    GroupStore.updateItems();
  },

  onDiscardError(_changeId: string, itemId: string, _response: any) {
    GroupStore.clearStatus(itemId, 'discard');
    showAlert(t('Unable to discard event. Please try again.'), 'error');
    GroupStore.updateItems();
  },

  onDiscardSuccess(_changeId: string, itemId: string, _response: any) {
    delete GroupStore.statuses[itemId];
    GroupStore.clearStatus(itemId, 'discard');
    GroupStore.items = GroupStore.items.filter(item => item.id !== itemId);
    showAlert(t('Similar events will be filtered and discarded.'), 'success');
    GroupStore.updateItems();
  },

  onMerge(_changeId: string, itemIds: ItemIds) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

    ids.forEach(itemId => GroupStore.addStatus(itemId, 'merge'));
    // XXX(billy): Not sure if this is a bug or not but do we need to publish all itemIds?
    // Seems like we only need to publish parent id
    GroupStore.updateItems();
  },

  onMergeError(_changeId: string, itemIds: ItemIds, _response: any) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

    ids.forEach(itemId => GroupStore.clearStatus(itemId, 'merge'));
    showAlert(t('Unable to merge events. Please try again.'), 'error');
    GroupStore.updateItems();
  },

  onMergeSuccess(_changeId: string, itemIds: ItemIds, response: any) {
    const ids = GroupStore.itemIdsOrAll(itemIds); // everything on page

    ids.forEach(itemId => GroupStore.clearStatus(itemId, 'merge'));

    // Remove all but parent id (items were merged into this one)
    const mergedIdSet = new Set(ids);

    // Looks like the `PUT /api/0/projects/:orgId/:projectId/issues/` endpoint
    // actually returns a 204, so there is no `response` body
    GroupStore.items = GroupStore.items.filter(
      item => !mergedIdSet.has(item.id) || item.id === response?.merge?.parent
    );

    if (ids.length > 0) {
      showAlert(t('Merged %d Issues', ids.length), 'success');
    }

    GroupStore.updateItems();
  },

  onUpdate(changeId: string, itemIds: ItemIds, data: any) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

    ids.forEach(itemId => {
      GroupStore.addStatus(itemId, 'update');
    });
    GroupStore.pendingChanges.set(changeId, {itemIds: ids, data});

    GroupStore.updateItems();
  },

  onUpdateError(changeId: string, itemIds: ItemIds, failSilently: boolean) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

    GroupStore.pendingChanges.delete(changeId);
    ids.forEach(itemId => GroupStore.clearStatus(itemId, 'update'));

    if (!failSilently) {
      showAlert(t('Unable to update events. Please try again.'), 'error');
    }

    GroupStore.updateItems();
  },

  onUpdateSuccess(changeId: string, itemIds: ItemIds, response: Partial<Group>) {
    const ids = GroupStore.itemIdsOrAll(itemIds);

    GroupStore.items.forEach((item, idx) => {
      if (ids.includes(item.id)) {
        GroupStore.items[idx] = {
          ...item,
          ...response,
        };
        GroupStore.clearStatus(item.id, 'update');
      }
    });
    GroupStore.pendingChanges.delete(changeId);
    GroupStore.updateItems();
  },

  onPopulateStats(itemIds: ItemIds, response: GroupStats[]) {
    // Organize stats by id
    const groupStatsMap = response.reduce<Record<string, GroupStats>>((map, stats) => {
      map[stats.id] = stats;
      return map;
    }, {});

    GroupStore.items.forEach((item, idx) => {
      if (itemIds?.includes(item.id)) {
        GroupStore.items[idx] = {
          ...item,
          ...groupStatsMap[item.id],
        };
      }
    });
    GroupStore.updateItems();
  },
};
