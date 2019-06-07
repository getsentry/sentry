import Reflux from 'reflux';
import {uniqBy} from 'lodash';

const SentryAppStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.deDup();
    this.trigger(this.items);
  },

  add(...apps) {
    apps.forEach(app => this.items.push(app));
    this.deDup();
    this.trigger(this.items);
  },

  get(slug) {
    return this.items.find(item => item.slug === slug);
  },

  getAll() {
    return this.items;
  },

  deDup() {
    this.items = uniqBy(this.items, i => i.uuid);
  },
});

export default SentryAppStore;
