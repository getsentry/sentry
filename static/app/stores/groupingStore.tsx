import pick from 'lodash/pick';
import {createStore} from 'reflux';

import {mergeGroups} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import toArray from 'sentry/utils/array/toArray';

import type {StrictStoreDefinition} from './types';

// Between 0-100
const MIN_SCORE = 0.6;

// @param score: {[key: string]: number}
const checkBelowThreshold = (scores = {}) => {
  const scoreKeys = Object.keys(scores);
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return !scoreKeys.map(key => scores[key]).find(score => score >= MIN_SCORE);
};

type State = {
  // "Compare" button state
  enableFingerprintCompare: boolean;
  error: boolean;
  filteredSimilarItems: SimilarItem[];
  loading: boolean;
  mergeDisabled: boolean;
  mergeList: string[];
  mergeState: Map<any, Readonly<{busy?: boolean; checked?: boolean}>>;
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
  unmergeState: Readonly<
    Map<any, Readonly<{busy?: boolean; checked?: boolean; collapsed?: boolean}>>
  >;
};

type ScoreMap = Record<string, number | null | string>;

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
    shouldBeGrouped?: string;
  };
  score?: Record<string, number | null>;
  scoresByInterface?: {
    exception: [string, number | null][];
    message: [string, any | null][];
    shouldBeGrouped?: [string, string | null][];
  };
};

type ResponseProcessors = {
  merged: (item: ApiFingerprint[]) => Fingerprint[];
  similar: (data: [Group, ScoreMap]) => {
    aggregate: Record<string, number | string>;
    isBelowThreshold: boolean;
    issue: Group;
    score: ScoreMap;
    scoresByInterface: Record<string, [string, number | null][]>;
  };
};

type DataKey = keyof ResponseProcessors;

type ResultsAsArrayDataMerged = Parameters<ResponseProcessors['merged']>[0];

type ResultsAsArrayDataSimilar = Parameters<ResponseProcessors['similar']>[0][];

type ResultsAsArray = {
  data: ResultsAsArrayDataMerged | ResultsAsArrayDataSimilar;
  dataKey: DataKey;
  links: string | null;
}[];

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
    toFetchArray: {
      dataKey: DataKey;
      endpoint: string;
      queryParams?: Record<string, any>;
    }[]
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
    orgSlug: Organization['slug'];
    errorMessage?: string;
    loadingMessage?: string;
    successMessage?: string;
  }): Promise<UnmergeResponse>;
  /**
   * Updates mergeState
   */
  setStateForId(
    stateProperty: 'mergeState' | 'unmergeState',
    idOrIds: string[] | string,
    newState: IdState
  ): void;
  triggerFetchState(): Readonly<
    Pick<
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
    >
  >;
  triggerMergeState(): Readonly<
    Pick<State, 'mergeState' | 'mergeDisabled' | 'mergeList'>
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
      },
      similar: ([issue, scoreMap]) => {
        // Check which similarity endpoint is being used
        const hasSimilarityEmbeddingsFeature = toFetchArray[0]?.endpoint.includes(
          'similar-issues-embeddings'
        );

        // Hide items with a low scores
        const isBelowThreshold = hasSimilarityEmbeddingsFeature
          ? false
          : checkBelowThreshold(scoreMap);

        // List of scores indexed by interface (i.e., exception and message)
        // Note: for v2, the interface is always "similarity". When v2 is
        // rolled out we can get rid of this grouping entirely.
        const scoresByInterface = Object.keys(scoreMap)
          .map(scoreKey => [scoreKey, scoreMap[scoreKey]])
          .reduce((acc, [scoreKey, score]) => {
            // v1 layout: '<interface>:...'
            const [interfaceName] = String(scoreKey).split(':') as [string];

            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            if (!acc[interfaceName]) {
              // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              acc[interfaceName] = [];
            }
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            acc[interfaceName].push([scoreKey, score]);

            return acc;
          }, {});

        // Aggregate score by interface
        const aggregate = Object.keys(scoresByInterface)
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          .map(interfaceName => [interfaceName, scoresByInterface[interfaceName]])
          .reduce((acc, [interfaceName, allScores]) => {
            // `null` scores means feature was not present in both issues, do not
            // include in aggregate
            // @ts-ignore TS(7031): Binding element 'score' implicitly has an 'any' ty... Remove this comment to see the full error message
            const scores = allScores.filter(([, score]) => score !== null);

            const avg =
              scores.reduce((sum: any, [, score]: any) => sum + score, 0) / scores.length;
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            acc[interfaceName] = hasSimilarityEmbeddingsFeature ? scores[0][1] : avg;
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

    return Promise.all(promises).then(
      resultsArray => {
        (resultsArray as ResultsAsArray).forEach(({dataKey, data, links}) => {
          const items =
            dataKey === 'similar'
              ? (data as ResultsAsArrayDataSimilar).map(responseProcessors[dataKey])
              : responseProcessors[dataKey](data as ResultsAsArrayDataMerged);

          this.state = {
            ...this.state,
            // Types here are pretty rough
            [`${dataKey}Items`]: items,
            [`${dataKey}Links`]: links,
          };
        });

        this.state = {...this.state, loading: false, error: false};
        this.triggerFetchState();
      },
      () => {
        this.state = {...this.state, loading: false, error: true};
        this.triggerFetchState();
      }
    );
  },

  // Toggle merge checkbox
  onToggleMerge(id) {
    let checked = false;

    // Don't do anything if item is busy
    const state = this.state.mergeState.has(id)
      ? this.state.mergeState.get(id)
      : undefined;

    if (state?.busy === true) {
      return;
    }

    if (this.state.mergeList.includes(id)) {
      this.state = {
        ...this.state,
        mergeList: this.state.mergeList.filter(item => item !== id),
      };
    } else {
      this.state = {...this.state, mergeList: [...this.state.mergeList, id]};
      checked = true;
    }

    this.setStateForId('mergeState', id, {checked});

    this.triggerMergeState();
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

  // For cross-project views, we need to pass projectId instead of
  // depending on router params (since we will only have orgId in that case)
  onMerge({params, query, projectId}) {
    if (!params) {
      return undefined;
    }

    const ids = this.state.mergeList;

    this.state = {...this.state, mergeDisabled: true};

    this.setStateForId('mergeState', ids, {busy: true});

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
            this.setStateForId('mergeState', ids, {checked: false, busy: true});
            this.state = {...this.state, mergeList: []};
          },
          error: () => {
            this.setStateForId('mergeState', ids, {checked: true, busy: false});
          },
          complete: () => {
            this.state = {...this.state, mergeDisabled: false};
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
    this.state = {
      ...this.state,
      similarItems: this.state.similarItems.filter(
        ({isBelowThreshold}) => !isBelowThreshold
      ),
      filteredSimilarItems: this.state.similarItems.filter(
        ({isBelowThreshold}) => isBelowThreshold
      ),
    };
    this.trigger(this.state);
    return this.state;
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

  triggerMergeState() {
    const state = pick(this.state, ['mergeDisabled', 'mergeState', 'mergeList']);
    this.trigger(state);
    return state;
  },

  getState(): State {
    return this.state;
  },
};

const GroupingStore = createStore(storeConfig);
export default GroupingStore;
