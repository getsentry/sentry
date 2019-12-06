import Reflux from 'reflux';

const DebugMetaActions = Reflux.createActions(['updateFilter']);

const DebugMetaStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(DebugMetaActions.updateFilter, this.updateFilter);
  },

  reset() {
    this.filter = null;
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.filter = word;
    this.trigger(this.get());
  },

  get() {
    return {
      filter: this.filter,
    };
  },
});

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
