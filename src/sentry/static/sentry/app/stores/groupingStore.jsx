import Reflux from 'reflux';

import IndicatorStore from './indicatorStore';
import {Client} from '../api';
import GroupingActions from '../actions/groupingActions';

const api = new Client();

// Between 0-100
const SIMILARITY_THRESHOLD = 75;

// @param score: {[key: string]: number}
const getAvgScore = score => {
  let scoreKeys = (score && Object.keys(score)) || [];
  return (
    scoreKeys.map(key => score[key]).reduce((acc, s) => acc + s * 100, 0) /
    scoreKeys.length
  );
};

const GroupingStore = Reflux.createStore({
  listenables: [GroupingActions],
  init() {
    this.unmergeList = new Set();
    this.unmergeState = new Map();

    this.mergeState = new Map();
    this.mergeList = new Set();

    this.unmergeDisabled = false;
    this.mergedItems = [];
    this.similarItems = [];
    this.filteredSimilarItems = [];
  },

  setStateForId(map, id, newState) {
    let state = (map.has(id) && map.get(id)) || {};
    let mergedState = Object.assign({}, state, newState);
    map.set(id, mergedState);
    return mergedState;
  },

  // Fetches data
  onFetch(toFetchArray) {
    let promises = toFetchArray.map(({endpoint, queryParams, dataKey}) => {
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
          locked: item.status === 'locked'
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

    Promise.all(promises).then(resultsArray => {
      resultsArray.forEach(({dataKey, data, links}) => {
        let items = data.map(responseProcessors[dataKey]);
        this[`${dataKey}Items`] = items;
        this[`${dataKey}Links`] = links;
      });

      this.trigger({
        // List of merged items that can be unmerged
        mergedItems: this.mergedItems,
        // Pagination for above list
        mergedLinks: this.mergedLinks,
        // List of similar items above min. score index
        similarItems: this.similarItems.filter(({isBelowThreshold}) => !isBelowThreshold),
        // List of similar items below min. score index
        filteredSimilarItems: this.similarItems.filter(
          ({isBelowThreshold}) => isBelowThreshold
        ),
        // Pagination for above list
        similarLinks: this.similarLinks,
        // State object for merged row items
        mergeState: this.mergeState,
        // State object for unmerge row items
        unmergeState: this.unmergeState
      });
    });
  },

  // Toggle merge checkbox
  onToggleMerge(id) {
    let checked;

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
  },

  // Toggle unmerge check box
  onToggleUnmerge(id) {
    let checked;

    // Uncheck an item to unmerge
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
        ({locked}) => locked
      ) || [];

      if (this.unmergeList.size + 1 < this.mergedItems.length - lockedItems.length) {
        this.unmergeList.add(id);
        checked = true;

        // Check if there's only one remaining item, and make sure to disable it from being
        // selected to unmerge
        if (this.unmergeList.size + 1 === this.mergedItems.length - lockedItems.length) {
          let remainingItem = this.mergedItems.find(
            item => !this.unmergeList.has(item.id)
          );
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
  },

  onUnmerge({groupId, loadingMessage, successMessage, errorMessage}) {
    let ids = Array.from(this.unmergeList.values());
    // Disable unmerge button
    this.unmergeDisabled = true;

    let loadingIndicator = IndicatorStore.add(loadingMessage);
    api.request(`/issues/${groupId}/hashes/`, {
      method: 'DELETE',
      query: {
        id: ids
      },
      success: (data, _, jqXHR) => {
        IndicatorStore.add(successMessage, 'success', {
          duration: 5000
        });
        this.unmergeDisabled = false;
      },
      error: error => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(errorMessage, 'error');
        this.unmergeDisabled = false;
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
        this.unmergeDisabled = false;
      }
    });

    // Disable rows
    ids.forEach(id => {
      this.setStateForId(this.unmergeState, id, {
        checked: false,
        locked: true,
        busy: true
      });
    });

    this.unmergeList.clear();

    this.triggerUnmergeState();
  },

  onMerge({params, query, loadingMessage, successMessage, errorMessage}) {
    let ids = Array.from(this.mergeList.values());
    // Disable merge button
    this.mergeDisabled = true;

    if (params) {
      let {orgId, groupId, projectId} = params;
      let loadingIndicator = IndicatorStore.add(loadingMessage);
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
            IndicatorStore.add(successMessage, 'success', {
              duration: 5000
            });
            // Hide rows after successful merge
            ids.forEach(id => {
              let state = this.mergeState.get(id) || {};
              this.mergeState.set(id, {
                ...state,
                visible: false
              });
            });
            this.mergeList.clear();
            this.mergeDisabled = false;
          },
          error: error => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(errorMessage, 'error');
            this.mergeDisabled = false;
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
            this.mergeDisabled = false;
          }
        }
      );
    }

    this.triggerMergeState();
  },

  triggerUnmergeState() {
    this.trigger({
      unmergeDisabled: this.unmergeDisabled,
      unmergeState: this.unmergeState,
      unmergeList: this.unmergeList
    });
  },

  triggerMergeState() {
    this.trigger({
      mergeDisabled: this.mergeDisabled,
      mergeState: this.mergeState,
      mergeList: this.mergeList
    });
  }
});

export default GroupingStore;
