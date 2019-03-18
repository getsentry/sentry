import Reflux from 'reflux';

const ExternalIssueStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },

  get(id) {
    return this.items.find(item => item.id === id);
  },

  getAll() {
    return this.items;
  },

  add(issue) {
    if (!this.items.some(i => i.id === issue.id)) {
      this.items = this.items.concat([issue]);
      this.trigger(this.items);
    }
  },
});

export default ExternalIssueStore;
