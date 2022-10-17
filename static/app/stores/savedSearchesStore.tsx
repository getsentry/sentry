import findIndex from 'lodash/findIndex';
import {createStore, StoreDefinition} from 'reflux';

import {SavedSearch, SavedSearchType} from 'sentry/types';

type State = {
  hasError: boolean;
  isLoading: boolean;
  savedSearches: SavedSearch[];
};

interface SavedSearchesStoreDefinition extends StoreDefinition {
  findByQuery(query: string, sort?: string): SavedSearch | undefined;
  get(): State;
  getFilteredSearches(type: SavedSearchType, id?: string): SavedSearch[];

  onCreateSavedSearchSuccess: (data) => void;
  onDeleteSavedSearchSuccess: (search: SavedSearch) => void;
  onFetchSavedSearchesError: (data) => void;

  onFetchSavedSearchesSuccess: (data) => void;
  onPinSearch(type: SavedSearchType, query: string, sort?: string): void;
  onPinSearchSuccess: (data) => void;
  onReset: () => void;
  onStartFetchSavedSearches: () => void;
  onUnpinSearch: (type: SavedSearchType) => void;

  reset(): void;
  updateExistingSearch(id: string, changes: Partial<SavedSearch>): SavedSearch;
}

const storeConfig: SavedSearchesStoreDefinition = {
  state: {
    savedSearches: [],
    hasError: false,
    isLoading: true,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

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
        (savedSearch: SavedSearch) =>
          !(
            savedSearch.isPinned &&
            savedSearch.type === type &&
            !savedSearch.isOrgCustom &&
            !savedSearch.isGlobal &&
            savedSearch.id !== existingSearchId
          )
      )
      .map((savedSearch: SavedSearch) => {
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
      (savedSearch: SavedSearch) => savedSearch.id === id
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
  findByQuery(query, sort) {
    return this.state.savedSearches.find(
      savedSearch => query === savedSearch.query && sort === savedSearch.sort
    );
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

  onCreateSavedSearchSuccess(data) {
    this.state = {
      ...this.state,
      savedSearches: [...this.state.savedSearches, data],
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

  onPinSearch(type, query, sort) {
    const existingSearch = this.findByQuery(query, sort);

    if (existingSearch) {
      this.updateExistingSearch(existingSearch.id, {isPinned: true});
    }

    const newPinnedSearch = !existingSearch
      ? [
          {
            id: null,
            name: 'My Pinned Search',
            type,
            query,
            sort,
            isPinned: true,
          },
        ]
      : [];

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

  onPinSearchSuccess(data) {
    const existingSearch = this.findByQuery(data.query, data.sort);

    if (existingSearch) {
      this.updateExistingSearch(existingSearch.id, data);
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
};

const SavedSearchesStore = createStore(storeConfig);
export default SavedSearchesStore;
