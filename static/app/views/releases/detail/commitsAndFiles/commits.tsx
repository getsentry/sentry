import {Fragment, useContext} from 'react';

import {Container} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useReleaseRepositories} from 'sentry/utils/useReleaseRepositories';
import {useRepositories} from 'sentry/utils/useRepositories';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {ReleaseContext} from 'sentry/views/releases/detail';
import {ReleaseCommit} from 'sentry/views/releases/detail/commitsAndFiles/releaseCommit';
import {
  getCommitsByRepository,
  getQuery,
  getReposToRender,
} from 'sentry/views/releases/detail/utils';
import {useReleaseCommits} from 'sentry/views/releases/utils/useReleaseCommits';

import {EmptyState, NoReleaseRepos, NoRepositories} from './emptyState';
import RepositorySwitcher from './repositorySwitcher';

interface CommitsProps {
  organization: Organization;
  projectSlug: Project['slug'];
  releaseRepos: Repository[];
}

function CommitsList({organization, releaseRepos, projectSlug}: CommitsProps) {
  const location = useLocation();
  const params = useParams<{release: string}>();
  const activeReleaseRepo =
    releaseRepos.find(repo => repo.name === location.query.activeRepo) ?? releaseRepos[0];

  const query = getQuery({location});
  const {
    data: commitList = [],
    isPending: isLoadingCommitList,
    error: commitListError,
    refetch,
    getResponseHeader,
  } = useReleaseCommits({
    release: params.release,
    projectSlug,
    activeRepository: activeReleaseRepo,
    ...query,
  });
  const commitsByRepository = getCommitsByRepository(commitList);
  const reposToRender = getReposToRender(Object.keys(commitsByRepository));
  const activeRepoName: string | undefined = activeReleaseRepo
    ? activeReleaseRepo.name
    : reposToRender[0];

  return (
    <Layout.Body>
      <Layout.Main width="full">
        <SentryDocumentTitle
          title={routeTitleGen(
            t('Commits - Release %s', formatVersion(params.release)),
            organization.slug,
            false,
            projectSlug
          )}
        />
        {releaseRepos.length > 1 && (
          <Container marginBottom="xl">
            <RepositorySwitcher
              repositories={releaseRepos}
              activeRepository={activeReleaseRepo}
            />
          </Container>
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
                  <ReleaseCommit key={commit.id} commit={commit} />
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

function Commits() {
  const organization = useOrganization();
  const params = useParams<{release: string}>();
  const releaseContext = useContext(ReleaseContext);
  const {
    data: repositories,
    isLoading: isLoadingRepositories,
    isError: isRepositoriesError,
    refetch: refetchRepositories,
  } = useRepositories({
    orgSlug: organization.slug,
  });
  const {
    data: releaseRepos,
    isLoading: isLoadingReleaseRepos,
    isError: isReleaseReposError,
    refetch: refetchReleaseRepos,
  } = useReleaseRepositories({
    orgSlug: organization.slug,
    projectSlug: releaseContext.project.slug,
    release: params.release,
    options: {
      enabled: !!releaseContext.project.slug,
    },
  });

  if (isLoadingReleaseRepos || isLoadingRepositories) {
    return <LoadingIndicator />;
  }

  if (isRepositoriesError || isReleaseReposError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchRepositories();
          refetchReleaseRepos();
        }}
      />
    );
  }

  const noReleaseReposFound = !releaseRepos?.length;
  if (noReleaseReposFound) {
    return <NoReleaseRepos />;
  }

  const noRepositoryOrgRelatedFound = !repositories?.length;
  if (noRepositoryOrgRelatedFound) {
    return <NoRepositories orgSlug={organization.slug} />;
  }

  return (
    <CommitsList
      releaseRepos={releaseRepos}
      organization={organization}
      projectSlug={releaseContext.project.slug}
    />
  );
}

export default Commits;
