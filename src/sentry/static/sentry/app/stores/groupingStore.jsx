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
    // List of merged items
    this.mergedItems = [];
    // List of items selected to be unmerged
    this.unmergeList = new Set();
    // State object for unmerged row items
    this.unmergeState = new Map();
    // Unmerge button state
    this.unmergeDisabled = false;

    // List of similar items above min. score index
    this.similarItems = [];
    // List of similar items below min. score index
    this.filteredSimilarItems = [];
    // Pagination for above list
    this.similarLinks = '';
    // State object for merged row items
    this.mergeState = new Map();
    // List of items selected to be merged
    this.mergeList = new Set();
    // Pagination for above list
    this.mergedLinks = '';
    // Merge button state
    this.mergeDisabled = false;

    this.loading = true;
    this.error = false;
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
          busy: item.status === 'locked'
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

    Promise.all(promises).then(
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
        this.error = true;
        this.triggerFetchState();
      }
    );

    if (toFetchArray) {
      this.toFetchArray = toFetchArray;
    }
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
      },
      error: error => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(errorMessage, 'error');
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
        this.unmergeDisabled = false;
        this.triggerUnmergeState();
      }
    });

    // Disable rows
    ids.forEach(id => {
      this.setStateForId(this.unmergeState, id, {
        checked: false,
        busy: true
      });
    });

    this.unmergeList.clear();

    this.triggerUnmergeState();
  },

  onMerge({params, query}) {
    let ids = Array.from(this.mergeList.values());
    // Disable merge button
    this.mergeDisabled = true;

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
            this.triggerMergeState();
          },
          error: () => {
            ids.forEach(id => {
              this.setStateForId(this.mergeState, id, {
                checked: true,
                busy: false
              });
            });
            this.triggerMergeState();
          },
          complete: () => {
            this.mergeDisabled = false;
            this.triggerMergeState();
          }
        }
      );
    }

    ids.forEach(id => {
      this.setStateForId(this.mergeState, id, {
        busy: true
      });
    });
    this.triggerMergeState();
  },

  triggerFetchState() {
    this.trigger({
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
    });
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
