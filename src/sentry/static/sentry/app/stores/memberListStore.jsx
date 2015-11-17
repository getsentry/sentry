import Reflux from 'reflux';

const MemberListStore = Reflux.createStore({
  // listenables: MemberActions,

  init() {
    this.items = [];
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.items = items;
    this.trigger(this.items, 'initial');
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

  getByEmail(email) {
    email = email.toLowerCase();
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].email.toLowerCase() === email) {
        return this.items[i];
      }
    }
    return null;
  },

  getAll() {
    return this.items;
  }
});

export default MemberListStore;
