import * as React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';
import {Repository} from 'app/types';
import LoadingIndicator from 'app/components/loadingIndicator';
import {addErrorMessage} from 'app/actionCreators/indicator';

import {ReleaseContext} from '..';
import NoRepoConnected from './noRepoConnected';

// We require these props when using this HOC
type Props = RouteComponentProps<{orgId: string; release: string}, {}> & {
  api: Client;
};

type State = {
  repositories: Array<Repository>;
  isLoading: boolean;
  activeRepository?: Repository | null;
};

const withRepositories = <P extends Props>(WrappedComponent: React.ComponentType<P>) =>
  (class extends React.Component<P, State> {
    static displayName = `withRepositories(${getDisplayName(WrappedComponent)})`;

    state: State = {
      repositories: [],
      isLoading: true,
    };

    componentDidMount() {
      this.fetchRepositories();
    }

    UNSAFE_componentWillReceiveProps(nextProps: P) {
      this.setActiveRepo(nextProps);
    }

    componentDidUpdate(_prevProps: P, prevState: State) {
      if (prevState.repositories.length !== this.state.repositories.length) {
        this.setActiveRepo(this.props);
      }
    }
    static contextType = ReleaseContext;

    setActiveRepo(props: P) {
      const {repositories, activeRepository} = this.state;

      if (!repositories.length) {
        return;
      }

      const activeRepo = props.location.query?.activeRepo;

      if (!activeRepo) {
        this.setState({
          activeRepository: repositories[0] ?? null,
        });
        return;
      }

      if (activeRepo === activeRepository?.name) {
        return;
      }

      const matchedRepository = repositories.find(repo => repo.name === activeRepo);

      if (matchedRepository) {
        this.setState({
          activeRepository: matchedRepository,
        });
        return;
      }

      addErrorMessage(t('The repository you were looking for was not found.'));
    }

    getEndpoint() {
      const {params} = this.props;
      const {release, orgId} = params;
      const {project} = this.context;

      return `/projects/${orgId}/${project.slug}/releases/${encodeURIComponent(
        release
      )}/repositories/`;
    }
    async fetchRepositories() {
      const {params} = this.props;
      const {release} = params;
      this.setState({isLoading: true});
      try {
        const repositories = await this.props.api.requestPromise(this.getEndpoint());
        this.setState({repositories, isLoading: false});
      } catch (error) {
        Sentry.captureException(error);
        addErrorMessage(
          t(
            'An error occured while trying to fetch the repositories of the release: %s',
            release
          )
        );
      }
    }

    render() {
      const {isLoading, activeRepository, repositories} = this.state;

      if (isLoading) {
        return <LoadingIndicator />;
      }

      if (!repositories.length) {
        return <NoRepoConnected orgId={this.props.params.orgId} />;
      }

      if (activeRepository === undefined) {
        return <LoadingIndicator />;
      }

      return (
        <WrappedComponent
          {...(this.props as P)}
          projectSlug={this.context.project.slug}
          repositories={repositories}
          activeRepository={activeRepository}
        />
      );
    }
  });

export default withRepositories;
