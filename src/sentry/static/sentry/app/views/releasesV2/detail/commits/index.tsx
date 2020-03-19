import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import CommitRow from 'app/components/commitRow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Repository, Commit, GlobalSelection} from 'app/types';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {PanelHeader, Panel, PanelBody} from 'app/components/panels';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import overflowEllipsisLeft from 'app/styles/overflowEllipsisLeft';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {getCommitsByRepository, CommitsByRepository} from '../utils';
import ReleaseNoCommitData from '../releaseNoCommitData';
import {ReleaseContext} from '../';

const ALL_REPOSITORIES_LABEL = t('All Repositories');

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  selection: GlobalSelection;
};

type State = {
  commits: Commit[];
  repos: Repository[];
  activeRepo: string;
} & AsyncComponent['state'];

class ReleaseCommits extends AsyncComponent<Props, State> {
  static contextType = ReleaseContext;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      activeRepo: ALL_REPOSITORIES_LABEL,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, selection} = this.props;
    const {orgId, release} = params;

    const project = this.context.projects.find(p => p.id === selection.projects[0]);

    return [
      [
        'commits',
        `/projects/${orgId}/${project.slug}/releases/${encodeURIComponent(
          release
        )}/commits/`,
      ],
      ['repos', `/organizations/${orgId}/repos/`],
    ];
  }

  handleRepoFilterChange = (repo: string) => {
    this.setState({activeRepo: repo});
  };

  renderRepoSwitcher(commitsByRepository: CommitsByRepository) {
    const repos = Object.keys(commitsByRepository);
    const {activeRepo} = this.state;

    return (
      <RepoSwitcher>
        <DropdownControl
          label={
            <React.Fragment>
              <FilterText>{t('Filter')}: &nbsp; </FilterText>
              {activeRepo}
            </React.Fragment>
          }
        >
          {[ALL_REPOSITORIES_LABEL, ...repos].map(repoName => (
            <DropdownItem
              key={repoName}
              onSelect={this.handleRepoFilterChange}
              eventKey={repoName}
              isActive={repoName === activeRepo}
            >
              <RepoLabel>{repoName}</RepoLabel>
            </DropdownItem>
          ))}
        </DropdownControl>
      </RepoSwitcher>
    );
  }

  renderCommitsForRepo(repo: string, commitsByRepository: CommitsByRepository) {
    return (
      <Panel key={repo}>
        <PanelHeader>{repo}</PanelHeader>
        <PanelBody>
          {commitsByRepository[repo].map(commit => (
            <CommitRow key={commit.id} commit={commit} />
          ))}
        </PanelBody>
      </Panel>
    );
  }

  renderBody() {
    const {orgId} = this.props.params;
    const {commits, repos, activeRepo} = this.state;

    const commitsByRepository = getCommitsByRepository(commits);
    const reposToRender =
      activeRepo === ALL_REPOSITORIES_LABEL
        ? Object.keys(commitsByRepository)
        : [activeRepo];

    if (repos.length === 0) {
      return <ReleaseNoCommitData orgId={orgId} />;
    }

    return (
      <ContentBox>
        {commits.length ? (
          <React.Fragment>
            {Object.keys(commitsByRepository).length > 1 &&
              this.renderRepoSwitcher(commitsByRepository)}
            {reposToRender.map(repoName =>
              this.renderCommitsForRepo(repoName, commitsByRepository)
            )}
          </React.Fragment>
        ) : (
          <EmptyStateWarning small>
            {t('There are no commits associated with this release.')}
          </EmptyStateWarning>
        )}
      </ContentBox>
    );
  }
}

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: ${p => p.theme.white};
`;

const RepoSwitcher = styled('div')`
  margin-bottom: ${space(1)};
`;

const FilterText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray2};
`;

const RepoLabel = styled('div')`
  ${overflowEllipsisLeft}
`;

export default withGlobalSelection(ReleaseCommits);
