import {Fragment} from 'react';

import {Container} from '@sentry/scraps/layout';

import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import {EmptyState} from 'sentry/views/releases/detail/commitsAndFiles/emptyState';
import {ReleaseCommit} from 'sentry/views/releases/detail/commitsAndFiles/releaseCommit';
import RepositorySwitcher from 'sentry/views/releases/detail/commitsAndFiles/repositorySwitcher';
import {
  getCommitsByRepository,
  getReposToRender,
} from 'sentry/views/releases/detail/utils';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';
import {useReleaseCommits} from 'sentry/views/releases/utils/useReleaseCommits';

interface CommitsProps {
  projectSlug: Project['slug'];
  release: string;
  releaseRepos: Repository[];
}

export function CommitsList({release, releaseRepos, projectSlug}: CommitsProps) {
  const {
    [ReleasesDrawerFields.COMMIT_CURSOR]: rdCiCursor,
    [ReleasesDrawerFields.ACTIVE_REPO]: rdActiveRepo,
  } = useLocationQuery({
    fields: {
      [ReleasesDrawerFields.COMMIT_CURSOR]: decodeScalar,
      [ReleasesDrawerFields.ACTIVE_REPO]: decodeScalar,
    },
  });
  const navigate = useNavigate();
  const activeReleaseRepo =
    releaseRepos.find(repo => repo.name === rdActiveRepo) ?? releaseRepos[0];

  const {
    data: commitList = [],
    isPending: isLoadingCommitList,
    error: commitListError,
    refetch,
    getResponseHeader,
  } = useReleaseCommits({
    release,
    projectSlug,
    activeRepository: activeReleaseRepo,
    cursor: rdCiCursor,
  });

  const commitsByRepository = getCommitsByRepository(commitList);
  const reposToRender = getReposToRender(Object.keys(commitsByRepository));
  const activeRepoName: string | undefined = activeReleaseRepo
    ? activeReleaseRepo.name
    : reposToRender[0];

  return (
    <Fragment>
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
        <Placeholder height="120px" />
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
          <Pagination
            pageLinks={getResponseHeader?.('Link')}
            onCursor={(cursor, path, searchQuery) => {
              navigate({
                pathname: path,
                query: {...searchQuery, [ReleasesDrawerFields.COMMIT_CURSOR]: cursor},
              });
            }}
          />
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
    </Fragment>
  );
}
