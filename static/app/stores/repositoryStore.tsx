import {createStore, Store, StoreDefinition} from 'reflux';

import RepoActions from 'sentry/actions/repositoryActions';
import {Repository} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type RepositoryStoreInterface = {
  get(): {
    orgSlug?: string;
    repositories?: Repository[];
    repositoriesError?: Error;
    repositoriesLoading?: boolean;
  };

  loadRepositories(orgSlug: string): void;

  loadRepositoriesError(error: Error): void;
  loadRepositoriesSuccess(data: Repository[]): void;
  state: {
    orgSlug?: string;
    repositories?: Repository[];
    repositoriesError?: Error;
    repositoriesLoading?: boolean;
  };
};

const storeConfig: StoreDefinition & RepositoryStoreInterface = {
  listenables: RepoActions,
  state: {
    orgSlug: undefined,
    repositories: undefined,
    repositoriesLoading: undefined,
    repositoriesError: undefined,
  },

  init() {
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

const RepositoryStore = createStore(makeSafeRefluxStore(storeConfig)) as Store &
  RepositoryStoreInterface;

export default RepositoryStore;
