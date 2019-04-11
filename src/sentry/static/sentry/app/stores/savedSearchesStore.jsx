import Reflux from 'reflux';

import SavedSearchesActions from 'app/actions/savedSearchesActions';

const SavedSearchesStore = Reflux.createStore({
  init() {
    const {
      fetchSavedSearches,
      fetchSavedSearchesSuccess,
      fetchSavedSearchesError,
      createSavedSearchSuccess,
      deleteSavedSearchSuccess,
      pinSearch,
      unpinSearch,
    } = SavedSearchesActions;

    this.reset();
    Reflux.listenTo(fetchSavedSearches, this.onFetchSavedSearches);
    Reflux.listenTo(fetchSavedSearchesSuccess, this.onFetchSavedSearchesSuccess);
    Reflux.listenTo(fetchSavedSearchesError, this.onFetchSavedSearchesError);
    Reflux.listenTo(createSavedSearchSuccess, this.onCreateSavedSearchSuccess);
    Reflux.listenTo(deleteSavedSearchSuccess, this.onDeleteSavedSearchSuccess);
    Reflux.listenTo(pinSearch, this.onPinSearch);
    Reflux.listenTo(unpinSearch, this.onUnpinSearch);
  },

  reset() {
    this.state = {
      savedSearches: [],
      isLoading: true,
    };
    this.trigger(this.state);
  },

  get() {
    return this.state;
  },

  /**
   * Return only unpinned searches for `type`
   */
  getUnpinned(type) {
    return this.state.savedSearches.filter(
      savedSearch => !(savedSearch.isPinned && savedSearch.type === type)
    );
  },

  onFetchSavedSearches() {
    this.state = {
      ...this.state,
      isLoading: true,
    };
    this.trigger(this.state);
  },

  onFetchSavedSearchesSuccess(data) {
    this.reset();
    this.state = {
      ...this.state,
      savedSearches: data,
      isLoading: false,
    };
    this.trigger(this.state);
  },

  onFetchSavedSearchesError(resp) {
    this.state = {
      ...this.state,
      savedSearches: [],
      isLoading: false,
      savedSearchError: true,
    };
    this.trigger(this.state);
  },

  onCreateSavedSearchSuccess(resp) {
    this.state = {
      ...this.state,
      savedSearches: [...this.state.savedSearches, resp],
    };

    this.trigger(this.state);
  },

  onPinSearch(type, query, ...args) {
    this.state = {
      ...this.state,
      savedSearches: [
        {
          id: null,
          isPinned: true,
          name: 'My Pinned Search',
          type,
          query,
          ...args,
        },
        // There can only be 1 pinned search, so unpin currently pinned search
        ...this.getUnpinned(type),
      ],
    };

    this.trigger(this.state);
  },

  onUnpinSearch(type) {
    this.state = {
      ...this.state,
      // Design decision that there can only be 1 pinned search per `type`
      savedSearches: this.getUnpinned(type),
    };
    this.trigger(this.state);
  },
});

export default SavedSearchesStore;
