import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {CommitRow} from 'sentry/components/commitRow';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Commit, Project, Repository} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {getCommitsByRepository, getQuery, getReposToRender} from '../utils';

import EmptyState from './emptyState';
import RepositorySwitcher from './repositorySwitcher';
import withReleaseRepos from './withReleaseRepos';

interface CommitsProps extends RouteComponentProps<{release: string}, {}> {
  location: Location;
  projectSlug: Project['slug'];
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
}

function Commits({activeReleaseRepo, releaseRepos, projectSlug}: CommitsProps) {
  const location = useLocation();
  const params = useParams<{release: string}>();
  const organization = useOrganization();

  const query = getQuery({location, activeRepository: activeReleaseRepo});
  const {
    data: commitList = [],
    isLoading: isLoadingCommitList,
    error: commitListError,
    refetch,
    getResponseHeader,
  } = useApiQuery<Commit[]>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(
        params.release
      )}/commits/`,
      {query},
    ],
    {
      staleTime: Infinity,
    }
  );

  const commitsByRepository = getCommitsByRepository(commitList);
  const reposToRender = getReposToRender(Object.keys(commitsByRepository));
  const activeRepoName: string | undefined = activeReleaseRepo
    ? activeReleaseRepo.name
    : reposToRender[0];

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <SentryDocumentTitle
          title={routeTitleGen(
            t('Commits - Release %s', formatVersion(params.release)),
            organization.slug,
            false,
            projectSlug
          )}
        />
        {releaseRepos.length > 1 && (
          <Actions>
            <RepositorySwitcher
              repositories={releaseRepos}
              activeRepository={activeReleaseRepo}
            />
          </Actions>
        )}
        {commitListError && <LoadingError onRetry={refetch} />}
        {isLoadingCommitList ? (
          <LoadingIndicator />
        ) : commitList.length && activeRepoName ? (
          <Fragment>
            <Panel>
              <PanelHeader>{activeRepoName}</PanelHeader>
              <PanelBody>
                {commitsByRepository[activeRepoName]?.map(commit => (
                  <CommitRow key={commit.id} commit={commit} />
                ))}
              </PanelBody>
            </Panel>
            <Pagination pageLinks={getResponseHeader?.('Link')} />
          </Fragment>
        ) : (
          <EmptyState>
            {activeReleaseRepo
              ? t(
                  'There are no commits associated with this release in the %s repository.',
                  activeReleaseRepo.name
                )
              : t('There are no commits associated with this release.')}
          </EmptyState>
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

const Actions = styled('div')`
  margin-bottom: ${space(2)};
`;

export default withReleaseRepos(Commits);
