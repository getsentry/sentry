import Reflux from 'reflux';

import IndicatorStore from './indicatorStore';
import {Client} from '../api';
import GroupingActions from '../actions/groupingActions';

const api = new Client();

// Between 0-100
const SIMILARITY_THRESHOLD = 50;

// @param score: {[key: string]: number}
const getAvgScore = score => {
  let scoreKeys = (score && Object.keys(score)) || [];
  return Math.round(
    scoreKeys.map(key => score[key]).reduce((acc, s) => acc + s * 100, 0) /
      scoreKeys.length
  );
};

const GroupingStore = Reflux.createStore({
  listenables: [GroupingActions],
  init() {
    let state = this.getDefaultState();

    Object.entries(state).forEach(([key, value]) => {
      this[key] = value;
    });
  },

  getDefaultState() {
    return {
      mergedItems: [],
      unmergeList: new Set(),
      unmergeState: new Map(),
      unmergeDisabled: false,

      similarItems: [],
      filteredSimilarItems: [],
      similarLinks: '',
      mergeState: new Map(),
      mergeList: new Set(),
      mergedLinks: '',
      mergeDisabled: false,

      loading: true,
      error: false
    };
  },

  setStateForId(map, id, newState) {
    let state = (map.has(id) && map.get(id)) || {};
    let mergedState = Object.assign({}, state, newState);
    map.set(id, mergedState);
    return mergedState;
  },

  // Fetches data
  onFetch(toFetchArray) {
    const requests = toFetchArray || this.toFetchArray;

    // Reset state and trigger update
    this.init();
    this.triggerFetchState();

    let promises = requests.map(({endpoint, queryParams, dataKey}) => {
      return new Promise((resolve, reject) => {
        api.request(endpoint, {
          method: 'GET',
          data: queryParams,
          success: (data, _, jqXHR) => {
            resolve({
              dataKey,
              data,
              links: jqXHR.getResponseHeader('Link')
            });
          },
          error: err => {
            let error = (err.responseJSON && err.responseJSON.detail) || true;
            reject(error);
          }
        });
      });
    });

    const responseProcessors = {
      merged: item => {
        // Check for locked items
        this.setStateForId(this.unmergeState, item.id, {
          busy: item.state === 'locked'
        });
        return item;
      },
      similar: ([issue, score]) => {
        // Hide items with a low average score
        let avgScore = getAvgScore(score);
        let isBelowThreshold = avgScore < SIMILARITY_THRESHOLD;

        return {
          issue,
          score,
          avgScore,
          isBelowThreshold
        };
      }
    };

    if (toFetchArray) {
      this.toFetchArray = toFetchArray;
    }

    return Promise.all(promises).then(
      resultsArray => {
        resultsArray.forEach(({dataKey, data, links}) => {
          let items = data.map(responseProcessors[dataKey]);
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
    let checked;

    // Don't do anything if item is busy
    let state = this.mergeState.has(id) && this.mergeState.get(id);
    if (!state || state.busy !== true) {
      if (this.mergeList.has(id)) {
        this.mergeList.delete(id);
        checked = false;
      } else {
        this.mergeList.add(id);
        checked = true;
      }

      this.setStateForId(this.mergeState, id, {
        checked
      });

      this.triggerMergeState();
    }
  },

  // Toggle unmerge check box
  onToggleUnmerge(id) {
    let checked;

    // Uncheck an item to unmerg
    let state = this.unmergeState.has(id) && this.unmergeState.get(id);
    if (!state || state.busy !== true) {
      if (this.unmergeList.has(id)) {
        this.unmergeList.delete(id);
        checked = false;

        // If there was a single unchecked item before, make sure we reset its disabled state
        if (this.remainingItem) {
          this.setStateForId(this.unmergeState, this.remainingItem.id, {
            disabled: false
          });
          this.remainingItem = null;
        }
      } else {
        // at least 1 item must be unchecked for unmerge
        // make sure that not all events have been selected

        // Account for items in unmerge queue, or "locked" items
        let lockedItems = Array.from(this.unmergeState.values()).filter(
          ({busy}) => busy
        ) || [];

        if (this.unmergeList.size + 1 < this.mergedItems.length - lockedItems.length) {
          this.unmergeList.add(id);
          checked = true;

          // Check if there's only one remaining item, and make sure to disable it from being
          // selected to unmerge
          if (
            this.unmergeList.size + 1 ===
            this.mergedItems.length - lockedItems.length
          ) {
            let remainingItem = this.mergedItems.find(item => {
              let notSelected = !this.unmergeList.has(item.id);
              let itemState =
                this.unmergeState.has(item.id) && this.unmergeState.get(item.id);
              return notSelected && (!itemState || !itemState.busy);
            });
            if (remainingItem) {
              this.remainingItem = remainingItem;
              this.setStateForId(this.unmergeState, remainingItem.id, {
                disabled: true
              });
            }
          }
        }
      }

      // Update "checked" state for row
      this.setStateForId(this.unmergeState, id, {
        checked
      });

      this.triggerUnmergeState();
    }
  },

  onUnmerge({groupId, loadingMessage, successMessage, errorMessage}) {
    let ids = Array.from(this.unmergeList.values());

    // Disable unmerge button
    this.unmergeDisabled = true;
    // Disable rows
    ids.forEach(id => {
      this.setStateForId(this.unmergeState, id, {
        checked: false,
        busy: true
      });
    });
    this.triggerUnmergeState();
    let loadingIndicator = IndicatorStore.add(loadingMessage);

    let promise = new Promise((resolve, reject) => {
      api.request(`/issues/${groupId}/hashes/`, {
        method: 'DELETE',
        query: {
          id: ids
        },
        success: (data, _, jqXHR) => {
          IndicatorStore.remove(loadingIndicator);
          IndicatorStore.add(successMessage, 'success', {
            duration: 5000
          });
          // Busy rows after successful merge
          ids.forEach(id => {
            this.setStateForId(this.unmergeState, id, {
              checked: false,
              busy: true
            });
          });
          this.unmergeList.clear();
          this.unmergeDisabled = false;
          resolve(this.triggerUnmergeState());
        },
        error: () => {
          IndicatorStore.remove(loadingIndicator);
          IndicatorStore.add(errorMessage, 'error');
          ids.forEach(id => {
            this.setStateForId(this.unmergeState, id, {
              checked: true,
              busy: false
            });
          });
          this.unmergeDisabled = false;
          resolve(this.triggerUnmergeState());
        }
      });
    });

    return promise;
  },

  onMerge({params, query}) {
    let ids = Array.from(this.mergeList.values());

    this.mergeDisabled = true;
    ids.forEach(id => {
      this.setStateForId(this.mergeState, id, {
        busy: true
      });
    });
    this.triggerMergeState();

    let promise = new Promise((resolve, reject) => {
      // Disable merge button

      if (params) {
        let {orgId, groupId, projectId} = params;
        api.merge(
          {
            orgId,
            projectId,
            // parent = last element in array
            itemIds: [...ids, groupId],
            query
          },
          {
            success: (data, _, jqXHR) => {
              // Hide rows after successful merge
              ids.forEach(id => {
                this.setStateForId(this.mergeState, id, {
                  checked: false,
                  busy: true
                });
              });
              this.mergeList.clear();
              this.mergeDisabled = false;
              resolve(this.triggerMergeState());
            },
            error: () => {
              ids.forEach(id => {
                this.setStateForId(this.mergeState, id, {
                  checked: true,
                  busy: false
                });
              });
              this.mergeDisabled = false;
              resolve(this.triggerMergeState());
            }
          }
        );
      } else {
        resolve(null);
      }
    });

    return promise;
  },

  triggerFetchState() {
    let state = {
      mergedItems: this.mergedItems,
      mergedLinks: this.mergedLinks,
      similarItems: this.similarItems.filter(({isBelowThreshold}) => !isBelowThreshold),
      filteredSimilarItems: this.similarItems.filter(
        ({isBelowThreshold}) => isBelowThreshold
      ),
      similarLinks: this.similarLinks,
      mergeState: this.mergeState,
      unmergeState: this.unmergeState,
      loading: this.loading,
      error: this.error
    };
    this.trigger(state);
    return state;
  },

  triggerUnmergeState() {
    let state = {
      unmergeDisabled: this.unmergeDisabled,
      unmergeState: this.unmergeState,
      unmergeList: this.unmergeList
    };
    this.trigger(state);
    return state;
  },

  triggerMergeState() {
    let state = {
      mergeDisabled: this.mergeDisabled,
      mergeState: this.mergeState,
      mergeList: this.mergeList
    };
    this.trigger(state);
    return state;
  }
});

export default GroupingStore;
