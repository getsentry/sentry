import pick from 'lodash/pick';
import Reflux from 'reflux';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import GroupingActions from 'app/actions/groupingActions';
import {Client} from 'app/api';
import {Event, Group, Organization, Project} from 'app/types';

// Between 0-100
const MIN_SCORE = 0.6;

// @param score: {[key: string]: number}
const checkBelowThreshold = (scores = {}) => {
  const scoreKeys = Object.keys(scores);
  return !scoreKeys.map(key => scores[key]).find(score => score >= MIN_SCORE);
};

type State = {
  // List of fingerprints that belong to issue
  mergedItems: [];
  // Map of {[fingerprint]: Array<fingerprint, event id>} that is selected to be unmerged
  unmergeList: Map<any, any>;
  // Map of state for each fingerprint (i.e. "collapsed")
  unmergeState: Map<any, any>;
  // Disabled state of "Unmerge" button in "Merged" tab (for Issues)
  unmergeDisabled: boolean;
  // If "Collapse All" was just used, this will be true
  unmergeLastCollapsed: boolean;
  // "Compare" button state
  enableFingerprintCompare: boolean;
  similarItems: [];
  filteredSimilarItems: [];
  similarLinks: string;
  mergeState: Map<any, any>;
  mergeList: Array<string>;
  mergedLinks: string;
  mergeDisabled: boolean;
  loading: boolean;
  error: boolean;
};

type ScoreMap = Record<string, number | null>;

type Item = {
  id: string;
  latestEvent: Event;
  state?: string;
};

type ResponseProcessors = {
  merged: (item: Item) => Item;
  similar: (
    data: [Group, ScoreMap]
  ) => {
    issue: Group;
    score: ScoreMap;
    scoresByInterface: Record<string, Array<[string, number | null]>>;
    aggregate: Record<string, number>;
    isBelowThreshold: boolean;
  };
};

type DataKey = keyof ResponseProcessors;

type ResultsAsArrayDataMerged = Array<Parameters<ResponseProcessors['merged']>[0]>;

type ResultsAsArrayDataSimilar = Array<Parameters<ResponseProcessors['similar']>[0]>;

type ResultsAsArray = Array<{
  dataKey: DataKey;
  data: ResultsAsArrayDataMerged | ResultsAsArrayDataSimilar;
  links: string | null;
}>;

type IdState = {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
};

type GroupingStoreInterface = Reflux.StoreDefinition & {
  init: () => void;
  getInitialState: () => State;
  setStateForId: (
    map: Map<string, IdState>,
    idOrIds: Array<string> | string,
    newState: IdState
  ) => Array<IdState>;
  isAllUnmergedSelected: () => boolean;
  onFetch: (
    toFetchArray?: Array<{
      dataKey: DataKey;
      endpoint: string;
      queryParams?: Record<string, any>;
    }>
  ) => Promise<any>;
  onToggleMerge: (id: string) => void;
  onToggleUnmerge: (props: [string, string] | string) => void;
  onUnmerge: (props: {
    groupId: Group['id'];
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  }) => void;
  onMerge: (props: {
    params?: {
      orgId: Organization['id'];
      projectId: Project['id'];
      groupId: Group['id'];
    };
    projectId?: Project['id'];
    query?: string;
  }) => undefined | Promise<any>;
  onToggleCollapseFingerprints: () => void;
  onToggleCollapseFingerprint: (fingerprint: string) => void;
  triggerFetchState: () => Pick<
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
  triggerUnmergeState: () => Pick<
    State,
    | 'unmergeDisabled'
    | 'unmergeState'
    | 'unmergeList'
    | 'enableFingerprintCompare'
    | 'unmergeLastCollapsed'
  >;
  triggerMergeState: () => Pick<State, 'mergeState' | 'mergeDisabled' | 'mergeList'>;
};

type Internals = {
  api: Client;
};

type GroupingStore = Reflux.Store & GroupingStoreInterface;

const storeConfig: Reflux.StoreDefinition & Internals & GroupingStoreInterface = {
  listenables: [GroupingActions],
  api: new Client(),

  init() {
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
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

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
            success: (data, _, jqXHR) => {
              resolve({
                dataKey,
                data,
                links: jqXHR ? jqXHR.getResponseHeader('Link') : null,
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
      merged: item => {
        // Check for locked items
        this.setStateForId(this.unmergeState, item.id, {
          busy: item.state === 'locked',
        });
        return item;
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
              : (data as ResultsAsArrayDataMerged).map(responseProcessors[dataKey]);
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

    // Unmerge should be disabled if 0 or all items are selected
    this.unmergeDisabled = this.unmergeList.size === 0 || this.isAllUnmergedSelected();
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

          // Busy rows after successful merge
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

      this.api.merge(
        {
          orgId,
          projectId: projectId || params.projectId,
          itemIds: [...ids, groupId] as Array<number>,
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
};

export default Reflux.createStore(storeConfig) as GroupingStore;
