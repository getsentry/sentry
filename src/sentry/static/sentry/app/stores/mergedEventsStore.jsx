import Reflux from 'reflux';

import Base from './groupingBase';
import GroupActions from '../actions/groupActions';
import MergedEventsActions from '../actions/mergedEventsActions';

const MergedEventsStore = Reflux.createStore(
  Object.assign({}, Base, {
    listenables: [MergedEventsActions, GroupActions],

    init() {
      let state = this.getInitialState();

      Object.entries(state).forEach(([key, value]) => {
        this[key] = value;
      });
    },

    // Resets status of a remaining item (to be unmerged) if it exists
    resetRemainingUnmergeItem() {
      if (!this.remainingItem) return;

      // If there was a single unchecked item before, make sure we reset its disabled state
      this.setStateForId(this.remainingItem.id, {
        disabled: false
      });
      this.remainingItem = null;
    },

    checkForRemainingUnmergeItem() {
      let lockedItems = Array.from(this.itemState.values()).filter(({busy}) => busy) || [
      ];
      let hasRemainingItem =
        this.selectedSet.size + 1 === this.items.length - lockedItems.length;

      if (!hasRemainingItem) return;

      // Check if there's only one remaining item, and make sure to disable it from being
      // selected to unmerge
      let remainingItem = this.items.find(item => {
        let notSelected = !this.selectedSet.has(item.id);
        let itemState = this.itemState.has(item.id) && this.itemState.get(item.id);
        return notSelected && (!itemState || !itemState.busy);
      });

      if (!remainingItem) return;

      this.remainingItem = remainingItem;
      this.setStateForId(remainingItem.id, {
        disabled: true
      });
    },

    onUnmergeSelected(api, params) {
      api.unmerge(
        Object.assign({}, params, {
          itemIds: Array.from(this.selectedSet.values())
        })
      );
    },

    onLoadMergedEvents() {
      this.init();
      this.loading = true;
      this.error = false;
      this.triggerFetchState();
    },

    onLoadMergedEventsSuccess(data, _, jqXHR) {
      let items = data.map(item => {
        // Check for locked items
        this.setStateForId(item.id, {
          busy: item.state === 'locked'
        });
        return item;
      });

      this.finishLoad({
        links: jqXHR.getResponseHeader('Link'),
        items
      });
    },

    onLoadMergedEventsError(err) {
      this.finishLoad({
        error: !!err,
        loading: false
      });
    },

    // Toggle unmerge check box
    onToggleSelect(id) {
      let checked;

      // Uncheck an item to unmerge
      let state = this.itemState.has(id) && this.itemState.get(id);

      if (state && state.busy === true) return;

      if (this.selectedSet.has(id)) {
        this.selectedSet.delete(id);
        checked = false;

        this.resetRemainingUnmergeItem();
      } else {
        // at least 1 item must be unchecked for unmerge
        // make sure that not all events have been selected

        // Account for items in unmerge queue, or "locked" items
        let lockedItems = Array.from(this.itemState.values()).filter(
          ({busy}) => busy
        ) || [];

        let canUnmerge =
          this.selectedSet.size + 1 < this.items.length - lockedItems.length;
        if (!canUnmerge) return;
        this.selectedSet.add(id);
        checked = true;

        this.checkForRemainingUnmergeItem();
      }

      // Update "checked" state for row
      this.setStateForId(id, {
        checked
      });

      this.triggerItemsState();
    },

    onUnmerge(uid, ids) {
      // Disable unmerge button
      this.actionButtonEnabled = false;

      // Disable rows
      this.setStateForId(ids, {
        checked: false,
        busy: true
      });
      this.triggerItemsState({
        unmergeStatus: 'started'
      });
    },

    onUnmergeSuccess(uid, ids) {
      // Busy rows after successful merge
      this.setStateForId(ids, {
        checked: false,
        busy: true
      });
      this.selectedSet.clear();
      this.actionButtonEnabled = true;
      this.triggerItemsState({
        unmergeStatus: 'success'
      });
    },

    onUnmergeError(uid, ids, error) {
      this.setStateForId(ids, {
        checked: true,
        busy: false
      });
      this.actionButtonEnabled = true;
      this.triggerItemsState({
        unmergeStatus: 'error'
      });
    }
  })
);

export default MergedEventsStore;
