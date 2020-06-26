import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {Client} from 'app/api';
import {Repository} from 'app/types';
import RepositoryActions from 'app/actions/repositoryActions';
import {getRepositories} from 'app/actionCreators/repositories';
import RepositoryStore from 'app/stores/repositoryStore';
import getDisplayName from 'app/utils/getDisplayName';

type DependentProps = {
  api: Client;
  orgSlug: string;
};

type InjectedProps = {
  repositories: Repository[] | undefined;
  repositoriesLoading: boolean | undefined;
  repositoriesError: Error | undefined;
};

const INITIAL_STATE: InjectedProps = {
  repositories: undefined,
  repositoriesLoading: undefined,
  repositoriesError: undefined,
};

const withRepositories = <P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedProps> & Partial<InjectedProps> & DependentProps,
    InjectedProps
  >({
    displayName: `withRepositories(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(RepositoryStore, 'onStoreUpdate') as any],

    getInitialState() {
      const {orgSlug} = this.props as P & DependentProps;
      const repoData = RepositoryStore.get();

      if (repoData.orgSlug !== orgSlug) {
        RepositoryActions.resetRepositories();
      }

      return repoData.orgSlug === orgSlug
        ? {...INITIAL_STATE, ...repoData}
        : {...INITIAL_STATE};
    },

    componentDidMount() {
      // XXX(leedongwei): Do not move this function call unless you modify the
      // unit test named "prevents repeated calls"
      this.fetchRepositories();
    },

    fetchRepositories() {
      const {api, orgSlug} = this.props as P & DependentProps;
      const repoData = RepositoryStore.get();

      // XXX(leedongwei): Do not check the orgSlug here. It would have been
      // verified at `getInitialState`. The short-circuit hack in actionCreator
      // does not update the orgSlug in the store.
      if (
        (!repoData.repositories && !repoData.repositoriesLoading) ||
        repoData.repositoriesError
      ) {
        getRepositories(api, {orgSlug});
      }
    },

    onStoreUpdate() {
      const repoData = RepositoryStore.get();
      this.setState({...repoData});
    },

    render() {
      return <WrappedComponent {...(this.props as P & DependentProps)} {...this.state} />;
    },
  });

export default withRepositories;
