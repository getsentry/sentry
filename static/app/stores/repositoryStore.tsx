import {createStore, StoreDefinition} from 'reflux';

import {Repository} from 'sentry/types';

type State = {
  orgSlug?: string;
  repositories?: Repository[];
  repositoriesError?: Error;
  repositoriesLoading?: boolean;
};

interface RepositoryStoreDefinition extends StoreDefinition {
  get(): State;
  loadRepositories(orgSlug: string): void;
  loadRepositoriesError(error: Error): void;
  loadRepositoriesSuccess(data: Repository[]): void;
  resetRepositories(): void;
  state: State;
}

const storeConfig: RepositoryStoreDefinition = {
  state: {
    orgSlug: undefined,
    repositories: undefined,
    repositoriesLoading: undefined,
    repositoriesError: undefined,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.resetRepositories();
  },

  resetRepositories() {
    this.state = {
      orgSlug: undefined,
      repositories: undefined,
      repositoriesLoading: undefined,
      repositoriesError: undefined,
    };
    this.trigger(this.state);
  },

  loadRepositories(orgSlug: string) {
    this.state = {
      orgSlug,
      repositories: orgSlug === this.state.orgSlug ? this.state.repositories : undefined,
      repositoriesLoading: true,
      repositoriesError: undefined,
    };
    this.trigger(this.state);
  },

  loadRepositoriesError(err: Error) {
    this.state = {
      ...this.state,
      repositories: undefined,
      repositoriesLoading: false,
      repositoriesError: err,
    };
    this.trigger(this.state);
  },

  loadRepositoriesSuccess(data: Repository[]) {
    this.state = {
      ...this.state,
      repositories: data,
      repositoriesLoading: false,
      repositoriesError: undefined,
    };
    this.trigger(this.state);
  },

  get() {
    return {...this.state};
  },
};

const RepositoryStore = createStore(storeConfig);
export default RepositoryStore;
