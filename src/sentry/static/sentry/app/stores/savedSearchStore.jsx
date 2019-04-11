import Reflux from 'reflux';

import SavedSearchActions from 'app/actions/savedSearchActions';

const SavedSearchesStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(SavedSearchActions.loadSavedSearches, this.onLoadSavedSearches);
    this.listenTo(SavedSearchActions.updateSavedSearches, this.onUpdateSavedSearches);
  },

  reset() {
    this.state = {
      isLoading: true,
      savedSearches: [],
    };
  },

  get() {
    return this.state;
  },

  onLoadSavedSearches() {
    this.reset();
    this.trigger(this.state);
  },

  onUpdateSavedSearches(savedSearches) {
    this.state = {
      isLoading: false,
      savedSearches,
    };
    this.trigger(this.state);
  },
});

export default SavedSearchesStore;
