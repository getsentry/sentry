import findIndex from 'lodash/findIndex';
import Reflux from 'reflux';

import SavedSearchesActions from 'sentry/actions/savedSearchesActions';
import {SavedSearch, SavedSearchType} from 'sentry/types';
import {makeSafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';

type State = {
  hasError: boolean;
  isLoading: boolean;
  savedSearches: SavedSearch[];
};

type SavedSearchesStoreInterface = {
  findByQuery(query: string, sort: string): SavedSearch | undefined;
  get(): State;
  getFilteredSearches(type: SavedSearchType, id?: string): SavedSearch[];
  onPinSearch(type: SavedSearchType, query: string, sort: string): void;
  reset(): void;
  updateExistingSearch(id: string, changes: Partial<SavedSearch>): SavedSearch;
};

const storeConfig: Reflux.StoreDefinition &
  SavedSearchesStoreInterface &
  SafeStoreDefinition = {
  unsubscribeListeners: [],

  state: {
    savedSearches: [],
    hasError: false,
    isLoading: true,
  },

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

    this.unsubscribeListeners.push(
      this.listenTo(startFetchSavedSearches, this.onStartFetchSavedSearches)
    );
    this.unsubscribeListeners.push(
      this.listenTo(fetchSavedSearchesSuccess, this.onFetchSavedSearchesSuccess)
    );
    this.unsubscribeListeners.push(
      this.listenTo(fetchSavedSearchesError, this.onFetchSavedSearchesError)
    );
    this.unsubscribeListeners.push(this.listenTo(resetSavedSearches, this.onReset));
    this.unsubscribeListeners.push(
      this.listenTo(createSavedSearchSuccess, this.onCreateSavedSearchSuccess)
    );
    this.unsubscribeListeners.push(
      this.listenTo(deleteSavedSearchSuccess, this.onDeleteSavedSearchSuccess)
    );
    this.unsubscribeListeners.push(this.listenTo(pinSearch, this.onPinSearch));
    this.unsubscribeListeners.push(
      this.listenTo(pinSearchSuccess, this.onPinSearchSuccess)
    );
    this.unsubscribeListeners.push(this.listenTo(unpinSearch, this.onUnpinSearch));

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

  onPinSearchSuccess(resp) {
    const existingSearch = this.findByQuery(resp.query, resp.sort);

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
};

const SavedSearchesStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SavedSearchesStoreInterface;

export default SavedSearchesStore;
