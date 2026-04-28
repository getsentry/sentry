import pick from 'lodash/pick';
import {createStore} from 'reflux';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {toArray} from 'sentry/utils/array/toArray';

import type {StrictStoreDefinition} from './types';

type State = {
  enableFingerprintCompare: boolean;
  error: boolean;
  loading: boolean;
  // List of fingerprints that belong to issue
  mergedItems: Fingerprint[];
  mergedLinks: string;
  // Disabled state of "Unmerge" button in "Merged" tab (for Issues)
  unmergeDisabled: boolean;
  // If "Collapse All" was just used, this will be true
  unmergeLastCollapsed: boolean;
  // Map of {[fingerprint]: Array<fingerprint, event id>} that is selected to be unmerged
  unmergeList: Map<any, any>;
  // Map of state for each fingerprint (i.e. "collapsed")
  unmergeState: Readonly<
    Map<any, Readonly<{busy?: boolean; checked?: boolean; collapsed?: boolean}>>
  >;
};

type ApiFingerprint = {
  id: string;
  latestEvent: Event;
  childId?: string;
  childLabel?: string;
  eventCount?: number;
  label?: string;
  lastSeen?: string;
  parentId?: string;
  parentLabel?: string;
  state?: string;
};

type ChildFingerprint = {
  childId: string;
  childLabel?: string;
  eventCount?: number;
  lastSeen?: string;
  latestEvent?: Event;
};

export type Fingerprint = {
  children: ChildFingerprint[];
  eventCount: number;
  id: string;
  latestEvent: Event;
  label?: string;
  lastSeen?: string;
  mergedBySeer?: boolean;
  parentId?: string;
  parentLabel?: string;
  state?: string;
};

type IdState = {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
};

type UnmergeResponse = Pick<
  State,
  | 'unmergeDisabled'
  | 'unmergeState'
  | 'unmergeList'
  | 'enableFingerprintCompare'
  | 'unmergeLastCollapsed'
>;

interface GroupingStoreDefinition extends StrictStoreDefinition<State> {
  api: Client;
  getInitialState(): State;
  init(): void;
  isAllUnmergedSelected(): boolean;
  onFetch(
    toFetchArray: Array<{
      dataKey: 'merged';
      endpoint: string;
      queryParams?: Record<string, any>;
    }>
  ): Promise<any>;
  onToggleCollapseFingerprint(fingerprint: string): void;
  onToggleCollapseFingerprints(): void;
  onToggleUnmerge(props: [string, string] | string): void;
  onUnmerge(props: {
    groupId: Group['id'];
    orgSlug: Organization['slug'];
    errorMessage?: string;
    loadingMessage?: string;
    successMessage?: string;
  }): Promise<UnmergeResponse>;
  /**
   * Updates unmergeState
   */
  setStateForId(
    stateProperty: 'unmergeState',
    idOrIds: string[] | string,
    newState: IdState
  ): void;
  triggerFetchState(): Readonly<
    Pick<State, 'mergedItems' | 'mergedLinks' | 'unmergeState' | 'loading' | 'error'>
  >;
  triggerUnmergeState(): Readonly<UnmergeResponse>;
}

const storeConfig: GroupingStoreDefinition = {
  // This will be populated on init
  state: {} as State,
  api: new Client(),

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = this.getInitialState();
  },

  getInitialState() {
    return {
      // List of fingerprints that belong to issue
      mergedItems: [],
      // Map of {[fingerprint]: Array<fingerprint, event id>} that is selected to be unmerged
      unmergeList: new Map(),
      // Map of state for each fingerprint (i.e. "collapsed")
      unmergeState: new Map(),
      // Disabled state of "Unmerge" button in "Merged" tab (for Issues)
      unmergeDisabled: true,
      // If "Collapse All" was just used, this will be true
      unmergeLastCollapsed: false,
      // "Compare" button state
      enableFingerprintCompare: false,
      mergedLinks: '',
      loading: true,
      error: false,
    };
  },

  setStateForId(stateProperty, idOrIds, newState) {
    const ids = toArray(idOrIds);
    const newMap = new Map(this.state[stateProperty]);

    ids.forEach(id => {
      const state = newMap.get(id) ?? {};
      const mergedState = {...state, ...newState};
      newMap.set(id, mergedState);
    });
    this.state = {...this.state, [stateProperty]: newMap};
  },

  isAllUnmergedSelected() {
    const lockedItems =
      (Array.from(this.state.unmergeState.values()) as IdState[]).filter(
        ({busy}) => busy
      ) || [];
    return (
      this.state.unmergeList.size ===
      this.state.mergedItems.filter(({latestEvent}) => !!latestEvent).length -
        lockedItems.length
    );
  },

  // Fetches data
  onFetch(toFetchArray) {
    // Reset state and trigger update
    this.init();
    this.triggerFetchState();

    const promises = toFetchArray.map(
      ({endpoint}) =>
        new Promise((resolve, reject) => {
          this.api.request(endpoint, {
            method: 'GET',
            success: (data, _, resp) => {
              resolve({
                data,
                links: resp ? resp.getResponseHeader('Link') : null,
              });
            },
            error: err => {
              const error = err.responseJSON?.detail || true;
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
              reject(error);
            },
          });
        })
    );

    const processMerged = (items: ApiFingerprint[]): Fingerprint[] => {
      const newItemsMap: Record<string, Fingerprint> = {};
      const newItems: Fingerprint[] = [];

      items.forEach(item => {
        if (!newItemsMap[item.id]) {
          const newItem = {
            eventCount: 0,
            children: [],
            // lastSeen and latestEvent properties are correct
            // since the server returns items in
            // descending order of lastSeen
            ...item,
          };
          // Check for locked items
          this.setStateForId('unmergeState', item.id, {
            busy: item.state === 'locked',
          });

          newItemsMap[item.id] = newItem;
          newItems.push(newItem);
        }

        const newItem = newItemsMap[item.id]!;
        const {childId, childLabel, eventCount, lastSeen, latestEvent} = item;

        if (eventCount) {
          newItem.eventCount += eventCount;
        }

        if (childId) {
          newItem.children.push({
            childId,
            childLabel,
            lastSeen,
            latestEvent,
            eventCount,
          });
        }
      });

      return newItems;
    };

    return Promise.all(promises).then(
      resultsArray => {
        (resultsArray as Array<{data: ApiFingerprint[]; links: string | null}>).forEach(
          ({data, links}) => {
            const items = processMerged(data);
            this.state = {
              ...this.state,
              mergedItems: items,
              mergedLinks: links ?? '',
            };
          }
        );

        this.state = {...this.state, loading: false, error: false};
        this.triggerFetchState();
        return resultsArray;
      },
      () => {
        this.state = {...this.state, loading: false, error: true};
        this.triggerFetchState();
        return [];
      }
    );
  },

  // Toggle unmerge check box
  onToggleUnmerge([fingerprint, eventId]) {
    let checked = false;

    // Uncheck an item to unmerge
    const state = this.state.unmergeState.get(fingerprint);

    if (state?.busy === true) {
      return;
    }

    const newUnmergeList = new Map(this.state.unmergeList);
    if (newUnmergeList.has(fingerprint)) {
      newUnmergeList.delete(fingerprint);
    } else {
      newUnmergeList.set(fingerprint, eventId);
      checked = true;
    }
    this.state = {...this.state, unmergeList: newUnmergeList};

    // Update "checked" state for row
    this.setStateForId('unmergeState', fingerprint!, {checked});

    // Unmerge should be disabled if 0 or all items are selected, or if there's
    // only one item to select
    const unmergeDisabled =
      this.state.mergedItems.length === 1 ||
      this.state.unmergeList.size === 0 ||
      this.isAllUnmergedSelected();

    const enableFingerprintCompare = this.state.unmergeList.size === 2;
    this.state = {...this.state, unmergeDisabled, enableFingerprintCompare};

    this.triggerUnmergeState();
  },

  onUnmerge({groupId, loadingMessage, orgSlug, successMessage, errorMessage}) {
    const grouphashIds = Array.from(this.state.unmergeList.keys()) as string[];

    return new Promise((resolve, reject) => {
      if (this.isAllUnmergedSelected()) {
        reject(new Error('Not allowed to unmerge ALL events'));
        return;
      }

      // Disable unmerge button
      this.state = {...this.state, unmergeDisabled: true};

      // Disable rows
      this.setStateForId('unmergeState', grouphashIds, {checked: false, busy: true});
      this.triggerUnmergeState();
      addLoadingMessage(loadingMessage);

      this.api.request(`/organizations/${orgSlug}/issues/${groupId}/hashes/`, {
        method: 'PUT',
        query: {
          id: grouphashIds,
        },
        success: () => {
          addSuccessMessage(successMessage);

          // Busy rows after successful Unmerge
          this.setStateForId('unmergeState', grouphashIds, {checked: false, busy: true});
          this.state.unmergeList.clear();
        },
        error: error => {
          errorMessage = error?.responseJSON?.detail || errorMessage;
          addErrorMessage(errorMessage);
          this.setStateForId('unmergeState', grouphashIds, {checked: true, busy: false});
        },
        complete: () => {
          this.state = {...this.state, unmergeDisabled: false};
          resolve(this.triggerUnmergeState());
        },
      });
    });
  },

  // Toggle collapsed state of all fingerprints
  onToggleCollapseFingerprints() {
    this.setStateForId(
      'unmergeState',
      this.state.mergedItems.map(({id}) => id),
      {
        collapsed: !this.state.unmergeLastCollapsed,
      }
    );

    this.state = {
      ...this.state,
      unmergeLastCollapsed: !this.state.unmergeLastCollapsed,
    };

    this.trigger({
      unmergeLastCollapsed: this.state.unmergeLastCollapsed,
      unmergeState: this.state.unmergeState,
    });
  },

  onToggleCollapseFingerprint(fingerprint) {
    const collapsed = this.state.unmergeState.get(fingerprint)?.collapsed;
    this.setStateForId('unmergeState', fingerprint, {collapsed: !collapsed});
    this.trigger({unmergeState: this.state.unmergeState});
  },

  triggerFetchState() {
    const state = pick(this.state, [
      'mergedItems',
      'mergedLinks',
      'unmergeState',
      'loading',
      'error',
    ]);
    this.trigger(state);
    return state;
  },

  triggerUnmergeState() {
    const state = pick(this.state, [
      'unmergeDisabled',
      'unmergeState',
      'unmergeList',
      'enableFingerprintCompare',
      'unmergeLastCollapsed',
    ]);
    this.trigger(state);
    return state;
  },

  getState(): State {
    return this.state;
  },
};

export const GroupingStore = createStore(storeConfig);
