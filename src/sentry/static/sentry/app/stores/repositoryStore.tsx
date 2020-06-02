import Reflux from 'reflux';

import RepoActions from 'app/actions/repositoryActions';
import {Repository} from 'app/types';

type RepositoryStoreInterface = {
  get(
    orgSlug?: string
  ): {
    repositories?: Repository[];
    repositoriesLoading?: boolean;
    repositoriesError?: Error;
  };

  state: {
    orgSlug?: string;
    repositories?: Repository[];
    repositoriesLoading?: boolean;
    repositoriesError?: Error;
  };

  loadRepositories(orgSlug: string): void;
  loadRepositoriesSuccess(data: Repository[]): void;
  loadRepositoriesError(error: Error): void;
};

const RepositoryStoreConfig: Reflux.StoreDefinition & RepositoryStoreInterface = {
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
    this.state.orgSlug = undefined;
    this.state.repositories = undefined;
    this.state.repositoriesLoading = undefined;
    this.state.repositoriesError = undefined;
    this.trigger(this.state);
  },

  loadRepositories(orgSlug: string) {
    this.state.orgSlug = orgSlug;
    this.state.repositoriesLoading = true;
    this.state.repositoriesError = undefined;
    this.trigger(this.state);
  },

  loadRepositoriesError(err: Error) {
    this.state.repositoriesLoading = false;
    this.state.repositoriesError = err;
    this.trigger(this.state);
  },

  loadRepositoriesSuccess(data: Repository[]) {
    this.state.repositories = data;
    this.state.repositoriesLoading = false;
    this.state.repositoriesError = undefined;
    this.trigger(this.state);
  },

  /**
   * `organizationSlug` is optional. If present, method will run a check if data
   * in the store originated from the same organization
   */
  get(orgSlug?: string) {
    const {orgSlug: stateOrgSlug, ...data} = this.state;
    if (orgSlug !== undefined && orgSlug !== stateOrgSlug) {
      return {
        repositories: undefined,
        repositoriesLoading: undefined,
        repositoriesError: undefined,
      };
    }

    return {...data};
  },
};

type RepositoryStore = Reflux.Store & RepositoryStoreInterface;
export default Reflux.createStore(RepositoryStoreConfig) as RepositoryStore;
