import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {getRepositories} from 'app/actionCreators/repositories';
import RepositoryActions from 'app/actions/repositoryActions';
import {Client} from 'app/api';
import RepositoryStore from 'app/stores/repositoryStore';
import {Organization, Repository} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type DependentProps = {
  api: Client;
  organization: Organization;
};

type InjectedProps = {
  repositories?: Repository[];
  repositoriesLoading?: boolean;
  repositoriesError?: Error;
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
      const {organization} = this.props as P & DependentProps;
      const orgSlug = organization.slug;
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
      const {api, organization} = this.props as P & DependentProps;
      const orgSlug = organization.slug;
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
