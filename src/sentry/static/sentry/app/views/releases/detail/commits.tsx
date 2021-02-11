import React from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import CommitRow from 'app/components/commitRow';
import {Body, Main} from 'app/components/layouts/thirds';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Commit, Organization, Project, Repository} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';

import EmptyState from './emptyState';
import RepositorySwitcher from './repositorySwitcher';
import {getCommitsByRepository, getQuery, getReposToRender} from './utils';
import withReleaseRepos from './withReleaseRepos';

type Props = RouteComponentProps<{orgId: string; release: string}, {}> & {
  location: Location;
  projectSlug: Project['slug'];
  orgSlug: Organization['slug'];
  release: string;
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
} & AsyncView['props'];

type State = {
  commits: Commit[];
} & AsyncView['state'];

class Commits extends AsyncView<Props, State> {
  getTitle() {
    const {params} = this.props;
    const {orgId} = params;

    return routeTitleGen(
      t('Commits - Release %s', formatVersion(params.release)),
      orgId,
      false
    );
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      commits: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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

  renderContent() {
    const {commits, commitsPageLinks} = this.state;
    const {activeReleaseRepo} = this.props;

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
      <React.Fragment>
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
      </React.Fragment>
    );
  }

  renderBody() {
    const {location, router, activeReleaseRepo, releaseRepos} = this.props;

    return (
      <React.Fragment>
        {releaseRepos.length > 1 && (
          <RepositorySwitcher
            repositories={releaseRepos}
            activeRepository={activeReleaseRepo}
            location={location}
            router={router}
          />
        )}
        {this.renderContent()}
      </React.Fragment>
    );
  }

  renderComponent() {
    return (
      <Body>
        <Main fullWidth>{super.renderComponent()}</Main>
      </Body>
    );
  }
}

export default withReleaseRepos(Commits);
