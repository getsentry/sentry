import * as React from 'react';

import {getRepositories} from 'sentry/actionCreators/repositories';
import RepositoryActions from 'sentry/actions/repositoryActions';
import {Client} from 'sentry/api';
import RepositoryStore from 'sentry/stores/repositoryStore';
import {Organization, Repository} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type DependentProps = {
  api: Client;
  organization: Organization;
};

type InjectedProps = {
  repositories?: Repository[];
  repositoriesError?: Error;
  repositoriesLoading?: boolean;
};

const INITIAL_STATE: InjectedProps = {
  repositories: undefined,
  repositoriesLoading: undefined,
  repositoriesError: undefined,
};

function withRepositories<P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithRepositories extends React.Component<P & DependentProps, InjectedProps> {
    static displayName = `withRepositories(${getDisplayName(WrappedComponent)})`;

    constructor(props: P & DependentProps, context: any) {
      super(props, context);

      const {organization} = this.props;
      const orgSlug = organization.slug;
      const repoData = RepositoryStore.get();

      if (repoData.orgSlug !== orgSlug) {
        RepositoryActions.resetRepositories();
      }

      this.state =
        repoData.orgSlug === orgSlug
          ? {...INITIAL_STATE, ...repoData}
          : {...INITIAL_STATE};
    }

    componentDidMount() {
      // XXX(leedongwei): Do not move this function call unless you modify the
      // unit test named "prevents repeated calls"
      this.fetchRepositories();
    }
    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = RepositoryStore.listen(() => this.onStoreUpdate(), undefined);

    fetchRepositories() {
      const {api, organization} = this.props;
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
    }

    onStoreUpdate() {
      const repoData = RepositoryStore.get();
      this.setState({...repoData});
    }

    render() {
      return <WrappedComponent {...this.props} {...this.state} />;
    }
  }

  return WithRepositories;
}

export default withRepositories;
