import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import {CommitRow} from 'sentry/components/commitRow';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {Commit, Organization, Project, Repository} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import routeTitleGen from 'sentry/utils/routeTitle';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import {getCommitsByRepository, getQuery, getReposToRender} from '../utils';

import EmptyState from './emptyState';
import RepositorySwitcher from './repositorySwitcher';
import withReleaseRepos from './withReleaseRepos';

type Props = RouteComponentProps<{release: string}, {}> & {
  location: Location;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  release: string;
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
} & DeprecatedAsyncView['props'];

type State = {
  commits: Commit[];
} & DeprecatedAsyncView['state'];

class Commits extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    const {params, orgSlug, projectSlug} = this.props;

    return routeTitleGen(
      t('Commits - Release %s', formatVersion(params.release)),
      orgSlug,
      false,
      projectSlug
    );
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      commits: [],
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.activeReleaseRepo?.name !== this.props.activeReleaseRepo?.name) {
      this.remountComponent();
      return;
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {
      projectSlug,
      activeReleaseRepo: activeRepository,
      location,
      orgSlug,
      release,
    } = this.props;

    const query = getQuery({location, activeRepository});

    return [
      [
        'commits',
        `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
          release
        )}/commits/`,
        {query},
      ],
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderContent() {
    const {commits, commitsPageLinks, loading} = this.state;
    const {activeReleaseRepo} = this.props;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!commits.length) {
      return (
        <EmptyState>
          {!activeReleaseRepo
            ? t('There are no commits associated with this release.')
            : t(
                'There are no commits associated with this release in the %s repository.',
                activeReleaseRepo.name
              )}
        </EmptyState>
      );
    }

    const commitsByRepository = getCommitsByRepository(commits);
    const reposToRender = getReposToRender(Object.keys(commitsByRepository));

    return (
      <Fragment>
        {reposToRender.map(repoName => (
          <Panel key={repoName}>
            <PanelHeader>{repoName}</PanelHeader>
            <PanelBody>
              {commitsByRepository[repoName]?.map(commit => (
                <CommitRow key={commit.id} commit={commit} />
              ))}
            </PanelBody>
          </Panel>
        ))}
        <Pagination pageLinks={commitsPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const {location, router, activeReleaseRepo, releaseRepos} = this.props;

    return (
      <Fragment>
        {releaseRepos.length > 1 && (
          <RepositorySwitcher
            repositories={releaseRepos}
            activeRepository={activeReleaseRepo}
            location={location}
            router={router}
          />
        )}
        {this.renderContent()}
      </Fragment>
    );
  }

  renderComponent() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>{super.renderComponent()}</Layout.Main>
      </Layout.Body>
    );
  }
}

export default withReleaseRepos(Commits);
