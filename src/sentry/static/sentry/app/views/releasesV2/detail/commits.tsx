import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import LoadingError from 'app/components/loadingError';
import AsyncComponent from 'app/components/asyncComponent';
import CommitRow from 'app/components/commitRow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Repository, Commit, Organization} from 'app/types';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {PanelHeader, Panel, PanelBody} from 'app/components/panels';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import overflowEllipsisLeft from 'app/styles/overflowEllipsisLeft';
import AsyncView from 'app/views/asyncView';
import routeTitleGen from 'app/utils/routeTitle';
import {formatVersion} from 'app/utils/formatters';
import withOrganization from 'app/utils/withOrganization';
import {Main} from 'app/components/layouts/thirds';
import Pagination from 'app/components/pagination';

import {getCommitsByRepository, CommitsByRepository} from './utils';
import ReleaseNoCommitData from './releaseNoCommitData';
import {ReleaseContext} from './';

const COMMITS_PER_PAGE = 20;
const ALL_REPOSITORIES_LABEL = t('All Repositories');

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  commits: Commit[];
  repos: Repository[];
  activeRepo: string;
} & AsyncComponent['state'];

class ReleaseCommits extends AsyncView<Props, State> {
  static contextType = ReleaseContext;

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this.setActiveRepo(nextProps);
  }

  componentDidMount() {
    this.setActiveRepo(this.props);
  }

  setActiveRepo(props: Props) {
    const activeRepo: string | undefined = props.location.query?.activeRepo;
    if (activeRepo !== this.state.activeRepo) {
      this.setState({activeRepo: activeRepo ?? ALL_REPOSITORIES_LABEL});
    }
  }

  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Commits - Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      activeRepo: ALL_REPOSITORIES_LABEL,
    };
  }

  getQuery() {
    const {location} = this.props;
    const {activeRepo} = this.state;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
      per_page: COMMITS_PER_PAGE,
    };

    if (activeRepo === ALL_REPOSITORIES_LABEL) {
      return query;
    }

    return {...query, repo_name: activeRepo};
  }

  getEndpoints = (): ReturnType<AsyncComponent['getEndpoints']> => {
    const {params} = this.props;
    const {orgId, release} = params;
    const {project} = this.context;
    const query = this.getQuery();

    return [
      [
        'commits',
        `/projects/${orgId}/${project.slug}/releases/${encodeURIComponent(
          release
        )}/commits/`,
        {query},
      ],
      ['repos', `/organizations/${orgId}/repos/`],
    ];
  };

  handleRepoFilterChange = (activeRepo: string) => {
    const {router, location} = this.props;

    router.push({
      ...location,
      query: {
        ...location.query,
        activeRepo: activeRepo === ALL_REPOSITORIES_LABEL ? undefined : activeRepo,
      },
    });
  };

  renderRepoSwitcher() {
    const {activeRepo, repos} = this.state;

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
          {[ALL_REPOSITORIES_LABEL, ...repos.map(repo => repo.name)].map(repoName => (
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

  renderError(error?: Error, disableLog = false, disableReport = false): React.ReactNode {
    const {errors} = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);
    if (notFound) {
      return (
        <React.Fragment>
          {this.renderRepoSwitcher()}
          <LoadingError
            message={t('We were unable to fetch commits by the selected repository.')}
          />
        </React.Fragment>
      );
    }
    return super.renderError(error, disableLog, disableReport);
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
    console.log('HEREEEE');
    const {orgId} = this.props.params;
    const {commits, repos, activeRepo, commitsPageLinks} = this.state;

    const commitsByRepository = getCommitsByRepository(commits);
    const reposToRender =
      activeRepo === ALL_REPOSITORIES_LABEL
        ? Object.keys(commitsByRepository)
        : [activeRepo];

    if (repos.length === 0) {
      return <ReleaseNoCommitData orgId={orgId} />;
    }

    if (commits.length === 0) {
      return (
        <Panel>
          <PanelBody>
            <EmptyStateWarning small>
              {t('There are no commits associated with this release.')}
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      );
    }

    return (
      <React.Fragment>
        {this.renderRepoSwitcher()}
        {reposToRender.map(repoName =>
          this.renderCommitsForRepo(repoName, commitsByRepository)
        )}
        <Pagination pageLinks={commitsPageLinks} />
      </React.Fragment>
    );
  }

  renderComponent() {
    return <Main fullWidth>{super.renderComponent()}</Main>;
  }
}

const RepoSwitcher = styled('div')`
  margin-bottom: ${space(1)};
`;

const FilterText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray500};
`;

const RepoLabel = styled('div')`
  ${overflowEllipsisLeft}
`;

export default withOrganization(ReleaseCommits);
