import $ from 'jquery';
import Reflux from 'reflux';
import isArray from 'lodash/isArray';

const EventStore = Reflux.createStore({
  init() {
    this.reset();
  },

  reset() {
    this.items = [];
  },

  loadInitialData(items) {
    this.reset();

    const itemIds = new Set();
    items.forEach(item => {
      itemIds.add(item.id);
      this.items.push(item);
    });

    this.trigger(itemIds);
  },

  add(items) {
    if (!isArray(items)) {
      items = [items];
    }

    const itemsById = {};
    const itemIds = new Set();
    items.forEach(item => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    });

    items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = $.extend(true, {}, item, itemsById[item.id]);
        delete itemsById[item.id];
      }
    });

    for (const itemId in itemsById) {
      this.items.push(itemsById[itemId]);
    }

    this.trigger(itemIds);
  },

  remove(itemId) {
    this.items.forEach((item, idx) => {
      if (item.id === itemId) {
        this.items.splice(idx, idx + 1);
      }
    });

    this.trigger(new Set([itemId]));
  },

  get(id) {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        return this.items[i];
      }
    }
    return undefined;
  },

  getAllItemIds() {
    return this.items.map(item => item.id);
  },

  getAllItems() {
    return this.items;
  },
});

export default EventStore;
