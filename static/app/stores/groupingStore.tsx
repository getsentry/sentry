import pick from 'lodash/pick';
import {createStore} from 'reflux';

import {mergeGroups} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import toArray from 'sentry/utils/toArray';

import {CommonStoreDefinition} from './types';

// Between 0-100
const MIN_SCORE = 0.6;

// @param score: {[key: string]: number}
const checkBelowThreshold = (scores = {}) => {
  const scoreKeys = Object.keys(scores);
  return !scoreKeys.map(key => scores[key]).find(score => score >= MIN_SCORE);
};

type State = {
  // "Compare" button state
  enableFingerprintCompare: boolean;
  error: boolean;
  filteredSimilarItems: SimilarItem[];
  loading: boolean;
  mergeDisabled: boolean;
  mergeList: Array<string>;
  mergeState: Map<any, any>;
  // List of fingerprints that belong to issue
  mergedItems: Fingerprint[];
  mergedLinks: string;
  similarItems: SimilarItem[];
  similarLinks: string;
  // Disabled state of "Unmerge" button in "Merged" tab (for Issues)
  unmergeDisabled: boolean;
  // If "Collapse All" was just used, this will be true
  unmergeLastCollapsed: boolean;
  // Map of {[fingerprint]: Array<fingerprint, event id>} that is selected to be unmerged
  unmergeList: Map<any, any>;
  // Map of state for each fingerprint (i.e. "collapsed")
  unmergeState: Map<any, any>;
};

type ScoreMap = Record<string, number | null>;

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
  children: Array<ChildFingerprint>;
  eventCount: number;
  id: string;
  latestEvent: Event;
  label?: string;
  lastSeen?: string;
  parentId?: string;
  parentLabel?: string;
  state?: string;
};

export type SimilarItem = {
  isBelowThreshold: boolean;
  issue: Group;
  aggregate?: {
    exception: number;
    message: number;
  };
  score?: Record<string, number | null>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
  };
};

type ResponseProcessors = {
  merged: (item: ApiFingerprint[]) => Fingerprint[];
  similar: (data: [Group, ScoreMap]) => {
    aggregate: Record<string, number>;
    isBelowThreshold: boolean;
    issue: Group;
    score: ScoreMap;
    scoresByInterface: Record<string, Array<[string, number | null]>>;
  };
};

type DataKey = keyof ResponseProcessors;

type ResultsAsArrayDataMerged = Parameters<ResponseProcessors['merged']>[0];

type ResultsAsArrayDataSimilar = Array<Parameters<ResponseProcessors['similar']>[0]>;

type ResultsAsArray = Array<{
  data: ResultsAsArrayDataMerged | ResultsAsArrayDataSimilar;
  dataKey: DataKey;
  links: string | null;
}>;

type IdState = {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
};

type InternalDefinition = {
  api: Client;
};

interface GroupingStoreDefinition
  extends CommonStoreDefinition<State>,
    InternalDefinition {
  getInitialState(): State;
  init(): void;
  isAllUnmergedSelected(): boolean;
  onFetch(
    toFetchArray?: Array<{
      dataKey: DataKey;
      endpoint: string;
      queryParams?: Record<string, any>;
    }>
  ): Promise<any>;
  onMerge(props: {
    projectId: Project['id'];
    params?: {
      groupId: Group['id'];
      orgId: Organization['id'];
    };
    query?: string;
  }): undefined | Promise<any>;
  onToggleCollapseFingerprint(fingerprint: string): void;
  onToggleCollapseFingerprints(): void;
  onToggleMerge(id: string): void;
  onToggleUnmerge(props: [string, string] | string): void;
  onUnmerge(props: {
    groupId: Group['id'];
    errorMessage?: string;
    loadingMessage?: string;
    successMessage?: string;
  }): void;
  setStateForId(
    map: Map<string, IdState>,
    idOrIds: Array<string> | string,
    newState: IdState
  ): Array<IdState>;
  triggerFetchState(): Pick<
    State,
    | 'similarItems'
    | 'filteredSimilarItems'
    | 'mergedItems'
    | 'mergedLinks'
    | 'similarLinks'
    | 'mergeState'
    | 'unmergeState'
    | 'loading'
    | 'error'
  >;
  triggerMergeState(): Pick<State, 'mergeState' | 'mergeDisabled' | 'mergeList'>;
  triggerUnmergeState(): Pick<
    State,
    | 'unmergeDisabled'
    | 'unmergeState'
    | 'unmergeList'
    | 'enableFingerprintCompare'
    | 'unmergeLastCollapsed'
  >;
}

const storeConfig: GroupingStoreDefinition = {
  api: new Client(),

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    const state = this.getInitialState();

    Object.entries(state).forEach(([key, value]) => {
      this[key] = value;
    });
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
      similarItems: [],
      filteredSimilarItems: [],
      similarLinks: '',
      mergeState: new Map(),
      mergeList: [],
      mergedLinks: '',
      mergeDisabled: false,
      loading: true,
      error: false,
    };
  },

  setStateForId(map, idOrIds, newState) {
    const ids = toArray(idOrIds);

    return ids.map(id => {
      const state = (map.has(id) && map.get(id)) || {};
      const mergedState = {...state, ...newState};
      map.set(id, mergedState);
      return mergedState;
    });
  },

  isAllUnmergedSelected() {
    const lockedItems =
      (Array.from(this.unmergeState.values()) as Array<IdState>).filter(
        ({busy}) => busy
      ) || [];
    return (
      this.unmergeList.size ===
      this.mergedItems.filter(({latestEvent}) => !!latestEvent).length -
        lockedItems.length
    );
  },

  // Fetches data
  onFetch(toFetchArray) {
    const requests = toFetchArray || this.toFetchArray;

    // Reset state and trigger update
    this.init();
    this.triggerFetchState();

    const promises = requests.map(
      ({endpoint, queryParams, dataKey}) =>
        new Promise((resolve, reject) => {
          this.api.request(endpoint, {
            method: 'GET',
            data: queryParams,
            success: (data, _, resp) => {
              resolve({
                dataKey,
                data,
                links: resp ? resp.getResponseHeader('Link') : null,
              });
            },
            error: err => {
              const error = err.responseJSON?.detail || true;
              reject(error);
            },
          });
        })
    );

    const responseProcessors: ResponseProcessors = {
      merged: items => {
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
            this.setStateForId(this.unmergeState, item.id, {
              busy: item.state === 'locked',
            });

            newItemsMap[item.id] = newItem;
            newItems.push(newItem);
          }

          const newItem = newItemsMap[item.id];
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
      },
      similar: ([issue, scoreMap]) => {
        // Hide items with a low scores
        const isBelowThreshold = checkBelowThreshold(scoreMap);

        // List of scores indexed by interface (i.e., exception and message)
        // Note: for v2, the interface is always "similarity". When v2 is
        // rolled out we can get rid of this grouping entirely.
        const scoresByInterface = Object.keys(scoreMap)
          .map(scoreKey => [scoreKey, scoreMap[scoreKey]])
          .reduce((acc, [scoreKey, score]) => {
            // v1 layout: '<interface>:...'
            const [interfaceName] = String(scoreKey).split(':');

            if (!acc[interfaceName]) {
              acc[interfaceName] = [];
            }
            acc[interfaceName].push([scoreKey, score]);

            return acc;
          }, {});

        // Aggregate score by interface
        const aggregate = Object.keys(scoresByInterface)
          .map(interfaceName => [interfaceName, scoresByInterface[interfaceName]])
          .reduce((acc, [interfaceName, allScores]) => {
            // `null` scores means feature was not present in both issues, do not
            // include in aggregate
            const scores = allScores.filter(([, score]) => score !== null);

            const avg = scores.reduce((sum, [, score]) => sum + score, 0) / scores.length;

            acc[interfaceName] = avg;
            return acc;
          }, {});

        return {
          issue,
          score: scoreMap,
          scoresByInterface,
          aggregate,
          isBelowThreshold,
        };
      },
    };

    if (toFetchArray) {
      this.toFetchArray = toFetchArray;
    }

    return Promise.all(promises).then(
      resultsArray => {
        (resultsArray as ResultsAsArray).forEach(({dataKey, data, links}) => {
          const items =
            dataKey === 'similar'
              ? (data as ResultsAsArrayDataSimilar).map(responseProcessors[dataKey])
              : responseProcessors[dataKey](data as ResultsAsArrayDataMerged);

          this[`${dataKey}Items`] = items;
          this[`${dataKey}Links`] = links;
        });

        this.loading = false;
        this.error = false;
        this.triggerFetchState();
      },
      () => {
        this.loading = false;
        this.error = true;
        this.triggerFetchState();
      }
    );
  },

  // Toggle merge checkbox
  onToggleMerge(id) {
    let checked = false;

    // Don't do anything if item is busy
    const state = this.mergeState.has(id) ? this.mergeState.get(id) : undefined;

    if (state?.busy === true) {
      return;
    }

    if (this.mergeList.includes(id)) {
      this.mergeList = this.mergeList.filter(item => item !== id);
    } else {
      this.mergeList = [...this.mergeList, id];
      checked = true;
    }

    this.setStateForId(this.mergeState, id, {
      checked,
    });

    this.triggerMergeState();
  },

  // Toggle unmerge check box
  onToggleUnmerge([fingerprint, eventId]) {
    let checked = false;

    // Uncheck an item to unmerge
    const state = this.unmergeState.get(fingerprint);

    if (state?.busy === true) {
      return;
    }

    if (this.unmergeList.has(fingerprint)) {
      this.unmergeList.delete(fingerprint);
    } else {
      this.unmergeList.set(fingerprint, eventId);
      checked = true;
    }

    // Update "checked" state for row
    this.setStateForId(this.unmergeState, fingerprint, {
      checked,
    });

    // Unmerge should be disabled if 0 or all items are selected, or if there's
    // only one item to select
    this.unmergeDisabled =
      this.mergedItems.size <= 1 ||
      this.unmergeList.size === 0 ||
      this.isAllUnmergedSelected();

    this.enableFingerprintCompare = this.unmergeList.size === 2;

    this.triggerUnmergeState();
  },

  onUnmerge({groupId, loadingMessage, successMessage, errorMessage}) {
    const ids = Array.from(this.unmergeList.keys()) as Array<string>;

    return new Promise((resolve, reject) => {
      if (this.isAllUnmergedSelected()) {
        reject(new Error('Not allowed to unmerge ALL events'));
        return;
      }

      // Disable unmerge button
      this.unmergeDisabled = true;

      // Disable rows
      this.setStateForId(this.unmergeState, ids, {
        checked: false,
        busy: true,
      });
      this.triggerUnmergeState();
      addLoadingMessage(loadingMessage);

      this.api.request(`/issues/${groupId}/hashes/`, {
        method: 'DELETE',
        query: {
          id: ids,
        },
        success: () => {
          addSuccessMessage(successMessage);

          // Busy rows after successful Unmerge
          this.setStateForId(this.unmergeState, ids, {
            checked: false,
            busy: true,
          });
          this.unmergeList.clear();
        },
        error: () => {
          addErrorMessage(errorMessage);
          this.setStateForId(this.unmergeState, ids, {
            checked: true,
            busy: false,
          });
        },
        complete: () => {
          this.unmergeDisabled = false;
          resolve(this.triggerUnmergeState());
        },
      });
    });
  },

  // For cross-project views, we need to pass projectId instead of
  // depending on router params (since we will only have orgId in that case)
  onMerge({params, query, projectId}) {
    if (!params) {
      return undefined;
    }

    const ids = this.mergeList;

    this.mergeDisabled = true;

    this.setStateForId(this.mergeState, ids as Array<string>, {
      busy: true,
    });

    this.triggerMergeState();

    const promise = new Promise(resolve => {
      // Disable merge button
      const {orgId, groupId} = params;

      mergeGroups(
        this.api,
        {
          orgId,
          projectId,
          itemIds: [...ids, groupId],
          query,
        },
        {
          success: data => {
            if (data?.merge?.parent) {
              this.trigger({
                mergedParent: data.merge.parent,
              });
            }

            // Hide rows after successful merge
            this.setStateForId(this.mergeState, ids as Array<string>, {
              checked: false,
              busy: true,
            });
            this.mergeList = [];
          },
          error: () => {
            this.setStateForId(this.mergeState, ids as Array<string>, {
              checked: true,
              busy: false,
            });
          },
          complete: () => {
            this.mergeDisabled = false;
            resolve(this.triggerMergeState());
          },
        }
      );
    });

    return promise;
  },

  // Toggle collapsed state of all fingerprints
  onToggleCollapseFingerprints() {
    this.setStateForId(
      this.unmergeState,
      this.mergedItems.map(({id}) => id),
      {
        collapsed: !this.unmergeLastCollapsed,
      }
    );

    this.unmergeLastCollapsed = !this.unmergeLastCollapsed;

    this.trigger({
      unmergeLastCollapsed: this.unmergeLastCollapsed,
      unmergeState: this.unmergeState,
    });
  },

  onToggleCollapseFingerprint(fingerprint) {
    const collapsed =
      this.unmergeState.has(fingerprint) && this.unmergeState.get(fingerprint).collapsed;
    this.setStateForId(this.unmergeState, fingerprint, {collapsed: !collapsed});
    this.trigger({
      unmergeState: this.unmergeState,
    });
  },

  triggerFetchState() {
    const state = {
      similarItems: this.similarItems.filter(({isBelowThreshold}) => !isBelowThreshold),
      filteredSimilarItems: this.similarItems.filter(
        ({isBelowThreshold}) => isBelowThreshold
      ),
      ...pick(this, [
        'mergedItems',
        'mergedLinks',
        'similarLinks',
        'mergeState',
        'unmergeState',
        'loading',
        'error',
        'enableFingerprintCompare',
        'unmergeList',
      ]),
    };
    this.trigger(state);
    return state;
  },

  triggerUnmergeState() {
    const state = pick(this, [
      'unmergeDisabled',
      'unmergeState',
      'unmergeList',
      'enableFingerprintCompare',
      'unmergeLastCollapsed',
    ]);
    this.trigger(state);
    return state;
  },

  triggerMergeState() {
    const state = pick(this, ['mergeDisabled', 'mergeState', 'mergeList']);
    this.trigger(state);
    return state;
  },

  getState(): State {
    return {
      ...pick(this, [
        'enableFingerprintCompare',
        'error',
        'filteredSimilarItems',
        'loading',
        'mergeDisabled',
        'mergeList',
        'mergeState',
        'mergeState',
        'mergedItems',
        'mergedLinks',
        'similarItems',
        'similarLinks',
        'unmergeDisabled',
        'unmergeLastCollapsed',
        'unmergeList',
        'unmergeState',
      ]),
    };
  },
};

const GroupingStore = createStore(storeConfig);
export default GroupingStore;
