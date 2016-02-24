import Reflux from 'reflux';
import TeamActions from '../actions/teamActions';

const TeamStore = Reflux.createStore({
  init() {
    this.items = [];

    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.items = [];
  },

  loadInitialData(items) {
    this.items = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  add(items) {
    if (!items instanceof Array) {
      items = [items];
    }

    let itemsById = {};
    let itemIds = new Set();
    items.forEach((item) => {
      itemsById[item.id] = item;
      itemIds.add(item.id);
    });

    items.forEach((item, idx) => {
      if (itemsById[item.id]) {
        this.items[idx] = jQuery.extend(true, {}, item, itemsById[item.id]);
        delete itemsById[item.id];
      }
    });

    for (let itemId in itemsById) {
      this.items.push(itemsById[itemId]);
    }

    this.trigger(itemIds);
  },

  onUpdateSuccess(changeId, itemId, response) {
    if (!response) {
      return;
    }
    let item = this.getBySlug(itemId);
    if (!item) {
      this.items.push(response);
    } else {
      $.extend(true, item, response);
    }
    this.trigger(new Set([itemId]));
  },

  getById(id) {
    id = '' + id;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        return this.items[i];
      }
    }
    return null;
  },

  getBySlug(slug) {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].slug === slug) {
        return this.items[i];
      }
    }
    return null;
  },

  getActive() {
    return this.items.filter((item) => item.isMember);
  },

  getAll() {
    return this.items;
  }
});

window.TeamStore = TeamStore;

export default TeamStore;

