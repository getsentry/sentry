import Reflux from 'reflux';
import {pick} from 'lodash';

import Base from './groupingBase';
import GroupActions from '../actions/groupActions';
import SimilarIssuesActions from '../actions/similarIssuesActions';

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

const SimilarIssueStore = Reflux.createStore(
  Object.assign({}, Base, {
    listenables: [SimilarIssuesActions, GroupActions],

    onLoadSimilarIssues() {
      this.init();
      this.loading = true;
      this.error = false;
      this.triggerFetchState();
    },

    onLoadSimilarIssuesSuccess(data, _, jqXHR) {
      let items = data.map(([issue, score]) => {
        // Hide items with a low average score
        let avgScore = getAvgScore(score);
        let isBelowThreshold = avgScore < SIMILARITY_THRESHOLD;

        return {
          issue,
          score,
          avgScore,
          isBelowThreshold
        };
      });

      this.finishLoad({
        links: jqXHR.getResponseHeader('Link'),
        items
      });
    },

    onLoadSimilarIssuesError(err) {
      this.finishLoad({
        type: 'similar',
        error: !!err
      });
    },

    // Toggle merge checkbox
    onToggleSelect(id) {
      let checked;

      // Don't do anything if item is busy
      let state = this.itemState.has(id) && this.itemState.get(id);
      if (state && state.busy === true) return;

      if (this.selectedSet.has(id)) {
        this.selectedSet.delete(id);
        checked = false;
      } else {
        this.selectedSet.add(id);
        checked = true;
      }

      this.setStateForId(id, {
        checked
      });

      this.triggerItemsState();
    },

    onMergeSelected(api, params) {
      // TODO(billy): throw error here?
      if (!params.groupId) return;

      api.merge(
        Object.assign({}, params, {
          itemIds: [...Array.from(this.selectedSet.values()), params.groupId]
        })
      );
    },

    onMerge(uid, ids) {
      this.actionButtonEnabled = false;
      this.setStateForId(ids, {
        busy: true
      });
      this.triggerItemsState();
    },

    onMergeSuccess(uid, ids, resp) {
      // Hide rows after successful merge
      this.setStateForId(ids, {
        checked: false,
        busy: true
      });
      this.selectedSet.clear();
      this.actionButtonEnabled = true;
      this.triggerItemsState();
    },

    onMergeError(uid, ids, err) {
      this.setStateForId(ids, {
        checked: true,
        busy: false
      });
      this.actionButtonEnabled = true;
      this.triggerItemsState();
    },

    triggerFetchState() {
      let state = {
        ...pick(this, ['items', 'links', 'itemState', 'loading', 'error']),
        items: this.items.filter(({isBelowThreshold}) => !isBelowThreshold),
        filteredItems: this.items.filter(({isBelowThreshold}) => isBelowThreshold)
      };
      this.trigger(state);
      return state;
    }
  })
);

export default SimilarIssueStore;
