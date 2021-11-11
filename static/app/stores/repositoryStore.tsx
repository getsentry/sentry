import Reflux from 'reflux';

import RepoActions from 'app/actions/repositoryActions';
import {Repository} from 'app/types';

type State = {
  orgSlug?: string;
  repositories: Repository[];
  repositoriesLoading: boolean;
  repositoriesError?: Error;
};

type RepositoryStoreInterface = {
  get(): State;
  state: State;
  loadRepositories(orgSlug: string): void;
  loadRepositoriesSuccess(data: Repository[]): void;
  loadRepositoriesError(error: Error): void;
  getState(): State;
};

const storeConfig: Reflux.StoreDefinition & RepositoryStoreInterface = {
  listenables: RepoActions,
  state: {
    orgSlug: undefined,
    repositories: [],
    repositoriesLoading: false,
    repositoriesError: undefined,
  },

  init() {
    this.resetRepositories();
  },

  resetRepositories() {
    this.state = {
      orgSlug: undefined,
      repositories: [],
      repositoriesLoading: false,
      repositoriesError: undefined,
    };
    this.trigger(this.state);
  },

  loadRepositories(orgSlug: string) {
    this.state = {
      orgSlug,
      repositories: orgSlug === this.state.orgSlug ? this.state.repositories : [],
      repositoriesLoading: true,
      repositoriesError: undefined,
    };
    this.trigger(this.state);
  },

  loadRepositoriesError(err: Error) {
    this.state = {
      ...this.state,
      repositories: [],
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

  getState() {
    return {...this.state};
  },
};

const RepositoryStore = Reflux.createStore(storeConfig) as Reflux.Store &
  RepositoryStoreInterface;

export default RepositoryStore;
