import {Fragment, useContext} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tn} from 'sentry/locale';
import type {CommitFile, Repository} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useReleaseRepositories} from 'sentry/utils/useReleaseRepositories';
import {useRepositories} from 'sentry/utils/useRepositories';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {ReleaseContext} from 'sentry/views/releases/detail';

import {getFilesByRepository, getQuery, getReposToRender} from '../utils';

import {EmptyState, NoReleaseRepos, NoRepositories} from './emptyState';
import FileChange from './fileChange';
import RepositorySwitcher from './repositorySwitcher';

interface FilesChangedProps {
  organization: Organization;
  projectSlug: Project['slug'];
  releaseRepos: Repository[];
}

function FilesChangedList({organization, releaseRepos, projectSlug}: FilesChangedProps) {
  const location = useLocation();
  const params = useParams<{release: string}>();
  const activeReleaseRepo =
    releaseRepos.find(repo => repo.name === location.query.activeRepo) ?? releaseRepos[0];

  const query = getQuery({location, activeRepository: activeReleaseRepo});
  const {
    data: fileList = [],
    isPending: isLoadingFileList,
    error: fileListError,
    refetch,
    getResponseHeader,
  } = useApiQuery<CommitFile[]>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(
        params.release
      )}/commitfiles/`,
      {query},
    ],
    {
      staleTime: Infinity,
    }
  );

  const filesByRepository = getFilesByRepository(fileList);
  const reposToRender = getReposToRender(Object.keys(filesByRepository));
  const fileListPageLinks = getResponseHeader?.('Link');

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(
          t('Files Changed - Release %s', formatVersion(params.release)),
          organization.slug,
          false,
          projectSlug
        )}
      />
      <Layout.Body>
        {releaseRepos.length > 1 && (
          <Layout.Main fullWidth>
            <RepositorySwitcher
              repositories={releaseRepos}
              activeRepository={activeReleaseRepo}
            />
          </Layout.Main>
        )}
        <Layout.Main fullWidth>
          {fileListError && <LoadingError onRetry={refetch} />}
          {isLoadingFileList ? (
            <LoadingIndicator />
          ) : fileList.length ? (
            <Fragment>
              {reposToRender.map(repoName => {
                const repoData = filesByRepository[repoName]!;
                const files = Object.keys(repoData);
                const fileCount = files.length;
                return (
                  <Panel key={repoName}>
                    <PanelHeader>
                      <span>{repoName}</span>
                      <span>{tn('%s file changed', '%s files changed', fileCount)}</span>
                    </PanelHeader>
                    <PanelBody>
                      {files.map(filename => {
                        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        const {authors} = repoData[filename];
                        return (
                          <FileChange
                            key={filename}
                            filename={filename}
                            authors={Object.values(authors)}
                          />
                        );
                      })}
                    </PanelBody>
                  </Panel>
                );
              })}
              <Pagination pageLinks={fileListPageLinks} />
            </Fragment>
          ) : (
            <EmptyState>
              {activeReleaseRepo
                ? t(
                    'There are no changed files associated with this release in the %s repository.',
                    activeReleaseRepo.name
                  )
                : t('There are no changed files associated with this release.')}
            </EmptyState>
          )}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function FilesChanged() {
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
    <FilesChangedList
      releaseRepos={releaseRepos}
      organization={organization}
      projectSlug={releaseContext.project.slug}
    />
  );
}

export default FilesChanged;
