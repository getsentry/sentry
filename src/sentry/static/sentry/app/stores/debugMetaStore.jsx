import Reflux from 'reflux';

const DebugMetaActions = Reflux.createActions(['updateFilter']);

const DebugMetaStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(DebugMetaActions.updateFilter, this.updateFilter);
  },

  reset() {
    this.filter = null;
    this.showUnused = false;
    this.showDetails = false;
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.filter = word;
    this.trigger(this.get());
  },
  // onUpdate(updatedOrg) {
  //   this.loading = false;
  //   this.error = null;
  //   this.errorType = null;
  //   this.organization = {...this.organization, ...updatedOrg};
  //   this.dirty = false;
  //   this.trigger(this.get());
  // },

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
