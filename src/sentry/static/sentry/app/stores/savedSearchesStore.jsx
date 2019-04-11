import Reflux from 'reflux';

import SavedSearchesActions from 'app/actions/savedSearchesActions';

const SavedSearchesStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(SavedSearchesActions.loadSavedSearches, this.onLoadSavedSearches);
    this.listenTo(SavedSearchesActions.updateSavedSearches, this.onUpdateSavedSearches);
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
