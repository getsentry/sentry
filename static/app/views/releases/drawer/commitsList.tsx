import {Fragment} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {EmptyState} from 'sentry/views/releases/detail/commitsAndFiles/emptyState';
import {ReleaseCommit} from 'sentry/views/releases/detail/commitsAndFiles/releaseCommit';
import RepositorySwitcher from 'sentry/views/releases/detail/commitsAndFiles/repositorySwitcher';
import {
  getCommitsByRepository,
  getReposToRender,
} from 'sentry/views/releases/detail/utils';
import {useReleaseCommits} from 'sentry/views/releases/utils/useReleaseCommits';

interface CommitsProps {
  projectSlug: Project['slug'];
  release: string;
  releaseRepos: Repository[];
}

export function CommitsList({release, releaseRepos, projectSlug}: CommitsProps) {
  const location = useLocation();
  const activeReleaseRepo =
    releaseRepos.find(repo => repo.name === location.query.activeRepo) ?? releaseRepos[0];

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
    // ...query,
  });
  const commitsByRepository = getCommitsByRepository(commitList);
  const reposToRender = getReposToRender(Object.keys(commitsByRepository));
  const activeRepoName: string | undefined = activeReleaseRepo
    ? activeReleaseRepo.name
    : reposToRender[0];

  return (
    <Fragment>
      {releaseRepos.length > 0 && (
        <Actions>
          <RepositorySwitcher
            repositories={releaseRepos}
            activeRepository={activeReleaseRepo}
          />
        </Actions>
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
    </Fragment>
  );
}

const Actions = styled('div')`
  margin-bottom: ${space(2)};
`;
