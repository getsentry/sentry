import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Badge} from 'sentry/components/core/badge';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReleaseMeta} from 'sentry/types/release';
import useOrganization from 'sentry/utils/useOrganization';
import {useReleaseRepositories} from 'sentry/utils/useReleaseRepositories';
import {useRepositories} from 'sentry/utils/useRepositories';
import {
  NoReleaseRepos,
  NoRepositories,
} from 'sentry/views/releases/detail/commitsAndFiles/emptyState';
import {CommitsList} from 'sentry/views/releases/drawer/commitsList';
import {FilesChangedList} from 'sentry/views/releases/drawer/filesChangedList';

interface CommitsSectionProps {
  isLoadingMeta: boolean;
  isMetaError: boolean;
  projectSlug: string | undefined;
  release: string;
  releaseMeta: ReleaseMeta | undefined;
}

/**
 * Tabbed + folded section for "Commits" and "Files Changed"
 */
export function CommitsFilesSection({
  isLoadingMeta,
  isMetaError,
  releaseMeta,
  projectSlug,
  release,
}: CommitsSectionProps) {
  const organization = useOrganization();
  const repositoriesQuery = useRepositories({
    orgSlug: organization.slug,
  });
  const releaseReposQuery = useReleaseRepositories({
    orgSlug: organization.slug,
    projectSlug: projectSlug ?? '',
    release,
    options: {
      enabled: !!projectSlug,
    },
  });
  const isError = repositoriesQuery.isError || releaseReposQuery.isError;
  const isLoading = repositoriesQuery.isPending || releaseReposQuery.isPending;
  const releaseRepos = releaseReposQuery.data;
  const repositories = repositoriesQuery.data;
  const noReleaseReposFound = !releaseRepos?.length;
  const noRepositoryOrgRelatedFound = !repositories?.length;

  return (
    <Tabs disabled={isError}>
      <TabListWithSpace>
        <TabList.Item key="commits" textValue={t('Commits')}>
          <Flex>
            <span>{t('Commits')}</span>
            <Badge type="default">
              {isLoadingMeta
                ? '-'
                : isMetaError
                  ? 'x'
                  : (releaseMeta?.commitCount ?? '0')}
            </Badge>
          </Flex>
        </TabList.Item>
        <TabList.Item key="files" textValue={t('File Changes')}>
          <Flex>
            <span>{t('File Changes')}</span>
            <Badge type="default">
              {isLoadingMeta
                ? '-'
                : isMetaError
                  ? 'x'
                  : (releaseMeta?.commitFilesChanged ?? '0')}
            </Badge>
          </Flex>
        </TabList.Item>
      </TabListWithSpace>
      {isLoading ? (
        <Placeholder height="100px" />
      ) : isError ? (
        <LoadingError
          onRetry={() => {
            releaseReposQuery.refetch();
            repositoriesQuery.refetch();
          }}
        />
      ) : noReleaseReposFound ? (
        <NoReleaseRepos />
      ) : noRepositoryOrgRelatedFound ? (
        <NoRepositories orgSlug={organization.slug} />
      ) : (
        <TabPanels>
          <TabPanels.Item key="commits">
            {releaseRepos?.length && projectSlug && (
              <CommitsList
                release={release}
                releaseRepos={releaseRepos}
                projectSlug={projectSlug}
              />
            )}
          </TabPanels.Item>
          <TabPanels.Item key="files">
            {releaseRepos?.length && (
              <FilesChangedList release={release} releaseRepos={releaseRepos} />
            )}
          </TabPanels.Item>
        </TabPanels>
      )}
    </Tabs>
  );
}

const TabListWithSpace = styled(TabList)`
  margin-bottom: ${space(1)};
`;
