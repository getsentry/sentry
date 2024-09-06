import {Fragment} from 'react';

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
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

import {getFilesByRepository, getQuery, getReposToRender} from '../utils';

import EmptyState from './emptyState';
import FileChange from './fileChange';
import RepositorySwitcher from './repositorySwitcher';
import withReleaseRepos from './withReleaseRepos';

// TODO(scttcper): Some props are no longer used, but required because of the HoC
interface FilesChangedProps extends RouteComponentProps<{release: string}, {}> {
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
}

function FilesChanged({activeReleaseRepo, releaseRepos, projectSlug}: FilesChangedProps) {
  const location = useLocation();
  const params = useParams<{release: string}>();
  const organization = useOrganization();

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
        <Layout.Main fullWidth>
          {releaseRepos.length > 1 && (
            <RepositorySwitcher
              repositories={releaseRepos}
              activeRepository={activeReleaseRepo}
            />
          )}
          {fileListError && <LoadingError onRetry={refetch} />}
          {isLoadingFileList ? (
            <LoadingIndicator />
          ) : fileList.length ? (
            <Fragment>
              {reposToRender.map(repoName => {
                const repoData = filesByRepository[repoName];
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

export default withReleaseRepos(FilesChanged);
