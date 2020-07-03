import findIndex from 'lodash/findIndex';
import Reflux from 'reflux';

import SavedSearchesActions from 'app/actions/savedSearchesActions';

const SavedSearchesStore = Reflux.createStore({
  init() {
    const {
      startFetchSavedSearches,
      fetchSavedSearchesSuccess,
      fetchSavedSearchesError,
      createSavedSearchSuccess,
      deleteSavedSearchSuccess,
      pinSearch,
      pinSearchSuccess,
      resetSavedSearches,
      unpinSearch,
    } = SavedSearchesActions;

    this.listenTo(startFetchSavedSearches, this.onStartFetchSavedSearches);
    this.listenTo(fetchSavedSearchesSuccess, this.onFetchSavedSearchesSuccess);
    this.listenTo(fetchSavedSearchesError, this.onFetchSavedSearchesError);
    this.listenTo(resetSavedSearches, this.onReset);
    this.listenTo(createSavedSearchSuccess, this.onCreateSavedSearchSuccess);
    this.listenTo(deleteSavedSearchSuccess, this.onDeleteSavedSearchSuccess);
    this.listenTo(pinSearch, this.onPinSearch);
    this.listenTo(pinSearchSuccess, this.onPinSearchSuccess);
    this.listenTo(unpinSearch, this.onUnpinSearch);

    this.reset();
  },

  reset() {
    this.state = {
      savedSearches: [],
      hasError: false,
      isLoading: true,
    };
  },

  get() {
    return this.state;
  },

  /**
   * If pinned search, remove from list if user created pin (e.g. not org saved search and not global)
   * Otherwise change `isPinned` to false (e.g. if it's default or org saved search)
   */
  getFilteredSearches(type, existingSearchId) {
    return this.state.savedSearches
      .filter(
        savedSearch =>
          !(
            savedSearch.isPinned &&
            savedSearch.type === type &&
            !savedSearch.isOrgCustom &&
            !savedSearch.isGlobal &&
            savedSearch.id !== existingSearchId
          )
      )
      .map(savedSearch => {
        if (
          typeof existingSearchId !== 'undefined' &&
          existingSearchId === savedSearch.id
        ) {
          // Do not update existing search
          return savedSearch;
        }

        return {...savedSearch, isPinned: false};
      });
  },

  updateExistingSearch(id, updateObj) {
    const index = findIndex(
      this.state.savedSearches,
      savedSearch => savedSearch.id === id
    );

    if (index === -1) {
      return null;
    }

    const existingSavedSearch = this.state.savedSearches[index];
    const newSavedSearch = {
      ...existingSavedSearch,
      ...updateObj,
    };
    this.state.savedSearches[index] = newSavedSearch;
    return newSavedSearch;
  },

  /**
   * Find saved search by query string
   */
  findByQuery(query) {
    return this.state.savedSearches.find(savedSearch => query === savedSearch.query);
  },

  /**
   * Reset store to initial state
   */
  onReset() {
    this.reset();
    this.trigger(this.state);
  },

  onStartFetchSavedSearches() {
    this.state = {
      ...this.state,
      isLoading: true,
    };
    this.trigger(this.state);
  },

  onFetchSavedSearchesSuccess(data) {
    if (!Array.isArray(data)) {
      data = [];
    }
    this.state = {
      ...this.state,
      savedSearches: data,
      isLoading: false,
    };
    this.trigger(this.state);
  },

  onFetchSavedSearchesError(_resp) {
    this.state = {
      ...this.state,
      savedSearches: [],
      isLoading: false,
      hasError: true,
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

  onDeleteSavedSearchSuccess(search) {
    this.state = {
      ...this.state,
      savedSearches: this.state.savedSearches.filter(item => item.id !== search.id),
    };

    this.trigger(this.state);
  },

  onPinSearch(type, query) {
    const existingSearch = this.findByQuery(query);

    if (existingSearch) {
      this.updateExistingSearch(existingSearch.id, {isPinned: true});
    }

    const newPinnedSearch =
      (!existingSearch && [
        {
          id: null,
          name: 'My Pinned Search',
          type,
          query,
          isPinned: true,
        },
      ]) ||
      [];

    this.state = {
      ...this.state,
      savedSearches: [
        ...newPinnedSearch,

        // There can only be 1 pinned search, so the rest must be unpinned
        // Also if we are pinning an existing search, then filter that out too
        ...this.getFilteredSearches(type, existingSearch && existingSearch.id),
      ],
    };
    this.trigger(this.state);
  },

  onPinSearchSuccess(resp) {
    const existingSearch = this.findByQuery(resp.query);

    if (existingSearch) {
      this.updateExistingSearch(existingSearch.id, resp);
    }

    this.trigger(this.state);
  },

  onUnpinSearch(type) {
    this.state = {
      ...this.state,
      // Design decision that there can only be 1 pinned search per `type`
      savedSearches: this.getFilteredSearches(type),
    };
    this.trigger(this.state);
  },
});

export default SavedSearchesStore;
