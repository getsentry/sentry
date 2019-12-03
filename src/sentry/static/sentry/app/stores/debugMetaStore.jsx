import Reflux from 'reflux';

const DebugMetaActions = Reflux.createActions(['updateFilters']);

const DebugMetaStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(DebugMetaActions.updateFilters, this.updateFilters);
  },

  reset() {
    this.filter = null;
    this.showUnused = false;
    this.showDetails = false;
    this.trigger(this.get());
  },

  updateFilters(word, showDetails = false, showUnused = false) {
    this.filter = word;
    this.showDetails = showDetails;
    this.showUnused = showUnused;
    this.trigger(this.get());
  },

  get() {
    return {
      showUnused: this.showUnused,
      showDetails: this.showDetails,
      filter: this.filter,
    };
  },
});

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
