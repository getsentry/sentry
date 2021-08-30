import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {Body, Main} from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel} from 'app/components/panels';
import {IconCommit} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Repository} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withRepositories from 'app/utils/withRepositories';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {ReleaseContext} from '.';

// These props are required when using this HoC
type DependentProps = RouteComponentProps<{orgId: string; release: string}, {}>;

type HoCsProps = {
  api: Client;
  organization: Organization;
  repositories?: Repository[];
  repositoriesLoading?: boolean;
  repositoriesError?: Error;
};

type State = {
  releaseRepos: Repository[];
  isLoading: boolean;
  activeReleaseRepo?: Repository;
};

function withReleaseRepos<P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithReleaseRepos extends React.Component<P & HoCsProps, State> {
    static displayName = `withReleaseRepos(${getDisplayName(WrappedComponent)})`;

    state: State = {
      releaseRepos: [],
      isLoading: true,
    };

    componentDidMount() {
      this.fetchReleaseRepos();
    }

    componentDidUpdate(prevProps: P & HoCsProps, prevState: State) {
      if (
        this.props.params.release !== prevProps.params.release ||
        (!!prevProps.repositoriesLoading && !this.props.repositoriesLoading)
      ) {
        this.fetchReleaseRepos();
        return;
      }

      if (
        prevState.releaseRepos.length !== this.state.releaseRepos.length ||
        prevProps.location.query?.activeRepo !== this.props.location.query?.activeRepo
      ) {
        this.setActiveReleaseRepo(this.props);
      }
    }

    static contextType = ReleaseContext;

    setActiveReleaseRepo(props: P & HoCsProps) {
      const {releaseRepos, activeReleaseRepo} = this.state;

      if (!releaseRepos.length) {
        return;
      }

      const activeCommitRepo = props.location.query?.activeRepo;

      if (!activeCommitRepo) {
        this.setState({
          activeReleaseRepo: releaseRepos[0] ?? null,
        });
        return;
      }

      if (activeCommitRepo === activeReleaseRepo?.name) {
        return;
      }

      const matchedRepository = releaseRepos.find(
        commitRepo => commitRepo.name === activeCommitRepo
      );

      if (matchedRepository) {
        this.setState({
          activeReleaseRepo: matchedRepository,
        });
        return;
      }

      addErrorMessage(t('The repository you were looking for was not found.'));
    }

    async fetchReleaseRepos() {
      const {params, api, repositories, repositoriesLoading} = this.props;

      if (repositoriesLoading === undefined || repositoriesLoading === true) {
        return;
      }

      if (!repositories?.length) {
        this.setState({isLoading: false});
        return;
      }

      const {release, orgId} = params;
      const {project} = this.context;

      this.setState({isLoading: true});

      try {
        const releasePath = encodeURIComponent(release);
        const releaseRepos = await api.requestPromise(
          `/projects/${orgId}/${project.slug}/releases/${releasePath}/repositories/`
        );
        this.setState({releaseRepos, isLoading: false});
        this.setActiveReleaseRepo(this.props);
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
      const {isLoading, activeReleaseRepo, releaseRepos} = this.state;
      const {repositoriesLoading, repositories, params, router, location, organization} =
        this.props;

      if (isLoading || repositoriesLoading) {
        return <LoadingIndicator />;
      }

      const noRepositoryOrgRelatedFound = !repositories?.length;

      if (noRepositoryOrgRelatedFound) {
        const {orgId} = params;
        return (
          <Body>
            <Main fullWidth>
              <Panel dashedBorder>
                <EmptyMessage
                  icon={<IconCommit size="xl" />}
                  title={t('Releases are better with commit data!')}
                  description={t(
                    'Connect a repository to see commit info, files changed, and authors involved in future releases.'
                  )}
                  action={
                    <Button priority="primary" to={`/settings/${orgId}/repos/`}>
                      {t('Connect a repository')}
                    </Button>
                  }
                />
              </Panel>
            </Main>
          </Body>
        );
      }

      const noReleaseReposFound = !releaseRepos.length;

      if (noReleaseReposFound) {
        return (
          <Body>
            <Main fullWidth>
              <Panel dashedBorder>
                <EmptyMessage
                  icon={<IconCommit size="xl" />}
                  title={t('Releases are better with commit data!')}
                  description={t(
                    'No commits associated with this release have been found.'
                  )}
                />
              </Panel>
            </Main>
          </Body>
        );
      }

      if (activeReleaseRepo === undefined) {
        return <LoadingIndicator />;
      }

      const {release} = params;
      const orgSlug = organization.slug;

      return (
        <WrappedComponent
          {...this.props}
          orgSlug={orgSlug}
          projectSlug={this.context.project.slug}
          release={release}
          router={router}
          location={location}
          releaseRepos={releaseRepos}
          activeReleaseRepo={activeReleaseRepo}
        />
      );
    }
  }

  return withApi(withOrganization(withRepositories(WithReleaseRepos)));
}

export default withReleaseRepos;
