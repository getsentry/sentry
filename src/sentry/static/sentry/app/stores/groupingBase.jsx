import {pick} from 'lodash';

export default {
  init() {
    let state = this.getInitialState();

    Object.entries(state).forEach(([key, value]) => {
      this[key] = value;
    });
  },

  getInitialState() {
    return {
      items: [],
      filteredItems: [],
      links: '',
      selectedSet: new Set(),
      itemState: new Map(),
      actionButtonEnabled: true,
      loading: true,
      error: false
    };
  },

  setStateForId(idOrIds, newState) {
    let ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    return ids.map(id => {
      let state = (this.itemState.has(id) && this.itemState.get(id)) || {};
      let mergedState = Object.assign({}, state, newState);
      this.itemState.set(id, mergedState);
      return mergedState;
    });
  },

  finishLoad({items, links, error}) {
    if (error) {
      this.loading = false;
      this.error = error;
      return this.triggerFetchState();
    }

    this.items = items;
    this.links = links;
    this.loading = false;
    this.error = false;

    return this.triggerFetchState();
  },

  triggerFetchState(additionalState = {}) {
    let state = {
      ...pick(this, ['items', 'links', 'itemState', 'loading', 'error']),
      ...additionalState
    };
    this.trigger(state);
    return state;
  },

  triggerItemsState(additionalState = {}) {
    let state = {
      ...pick(this, ['actionButtonEnabled', 'itemState', 'selectedSet']),
      ...additionalState
    };
    this.trigger(state);
    return state;
  }
};
