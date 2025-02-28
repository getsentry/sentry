import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {TabPanels, Tabs} from 'sentry/components/tabs';
import {TabList} from 'sentry/components/tabs/tabList';
import {t} from 'sentry/locale';
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
import {FoldSection, SectionDivider} from 'sentry/views/releases/drawer/foldSection';

interface CommitsSectionProps {
  isLoadingMeta: boolean;
  isMetaError: boolean;
  projectSlug: string;
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
    projectSlug,
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
    <Fragment>
      <Tabs disabled={isError}>
        <FoldSection
          sectionKey="commits"
          title={
            <TabList hideBorder>
              <TabList.Item key="commits">
                <TitleWithBadge>
                  <span>{t('Commits')}</span>
                  <Badge type="default">
                    {isLoadingMeta
                      ? '-'
                      : isMetaError
                        ? 'x'
                        : releaseMeta?.commitCount ?? '0'}
                  </Badge>
                </TitleWithBadge>
              </TabList.Item>
              <TabList.Item key="files">
                <TitleWithBadge>
                  <span>{t('File Changes')}</span>
                  <Badge type="default">
                    {isLoadingMeta
                      ? '-'
                      : isMetaError
                        ? 'x'
                        : releaseMeta?.commitFilesChanged ?? '0'}
                  </Badge>
                </TitleWithBadge>
              </TabList.Item>
            </TabList>
          }
        >
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
                {releaseRepos?.length && (
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
        </FoldSection>
      </Tabs>
      <SectionDivider />
    </Fragment>
  );
}

const TitleWithBadge = styled('div')`
  display: flex;
`;
