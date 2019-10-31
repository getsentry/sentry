import Reflux from 'reflux';
import DiscoverSavedQueryActions from 'app/actions/discoverSavedQueryActions';

type Versions = 1 | 2;

export type NewQuery = {
  id: string | undefined;
  version: Versions;
  name: string;
  projects: Readonly<number[]>;
  fields: Readonly<string[]>;
  fieldnames: Readonly<string[]>;
  query: string;
  orderby?: string;
  range?: string;
  start?: string;
  end?: string;
  environment?: Readonly<string[]>;
  tags?: Readonly<string[]>;
  yAxis?: string;
};

export type SavedQuery = NewQuery & {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  createdBy?: string;
};

export type SavedQueryState = {
  savedQueries: SavedQuery[];
  hasError: boolean;
  isLoading: boolean;
};

const DiscoverSavedQueriesStore = Reflux.createStore({
  init() {
    const {
      resetSavedQueries,
      startFetchSavedQueries,
      fetchSavedQueriesSuccess,
      fetchSavedQueriesError,
      createSavedQuerySuccess,
      deleteSavedQuerySuccess,
      updateSavedQuerySuccess,
    } = DiscoverSavedQueryActions;

    this.listenTo(resetSavedQueries, this.onReset);
    this.listenTo(startFetchSavedQueries, this.onStartFetchSavedQueries);
    this.listenTo(fetchSavedQueriesSuccess, this.fetchSavedQueriesSuccess);
    this.listenTo(fetchSavedQueriesError, this.fetchSavedQueriesError);
    this.listenTo(createSavedQuerySuccess, this.createSavedQuerySuccess);
    this.listenTo(updateSavedQuerySuccess, this.updateSavedQuerySuccess);
    this.listenTo(deleteSavedQuerySuccess, this.deleteSavedQuerySuccess);

    this.reset();
  },
  get(): SavedQueryState {
    return this.state;
  },

  reset(): void {
    this.state = {
      savedQueries: [],
      hasError: false,
      isLoading: true,
    } as SavedQueryState;
  },

  onReset(): void {
    this.reset();
    this.trigger(this.state);
  },

  onStartFetchSavedQueries(): void {
    this.state = {
      ...this.state,
      isLoading: true,
    };
    this.trigger(this.state);
  },

  fetchSavedQueriesSuccess(data: SavedQuery[]): void {
    this.state = {
      ...this.state,
      savedQueries: data,
      isLoading: false,
      hasError: false,
    };
    this.trigger(this.state);
  },

  fetchSavedQueriesError(): void {
    this.state = {
      ...this.state,
      savedQueries: [],
      isLoading: false,
      hasError: true,
    };
    this.trigger(this.state);
  },

  createSavedQuerySuccess(query): void {
    this.state = {
      ...this.state,
      savedQueries: [...this.state.savedQueries, query],
    };
    this.trigger(this.state);
  },

  updateSavedQuerySuccess(query): void {
    let savedQueries;
    const index = this.state.savedQueries.findIndex(item => item.id === query.id);
    if (index > -1) {
      savedQueries = [...this.state.savedQueries];
      savedQueries.splice(index, 1, query);
    } else {
      savedQueries = [...this.state.savedQueries, query];
    }
    this.state = {
      ...this.state,
      savedQueries,
    };
    this.trigger(this.state);
  },

  deleteSavedQuerySuccess(id): void {
    const savedQueries = [...this.state.savedQueries.filter(query => query.id !== id)];
    this.state = {
      ...this.state,
      savedQueries,
    };
    this.trigger(this.state);
  },
});

// TODO(ts): This should be properly typed
export default DiscoverSavedQueriesStore as any;
