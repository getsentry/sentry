import {useMemo, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {
  SnapshotDetailsApiResponse,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotHeaderContent} from './header/snapshotHeaderContent';
import {SnapshotMainContent} from './main/snapshotMainContent';
import {SnapshotSidebarContent} from './sidebar/snapshotSidebarContent';

export default function SnapshotsPage() {
  const organization = useOrganization();
  const {projectId, projectSlug, snapshotId} = useParams<{
    projectId: string;
    projectSlug: string;
    snapshotId: string;
  }>();

  const {data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage} =
    useInfiniteApiQuery<SnapshotDetailsApiResponse>({
      queryKey: [
        'infinite',
        getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: projectSlug,
              snapshotId,
            },
          }
        ),
        {query: {per_page: 20}},
      ],
      staleTime: 0,
      enabled: !!projectSlug && !!snapshotId,
    });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);

  const firstPageData = data?.pages[0]?.[0];

  const groupedImages = useMemo(() => {
    if (!data?.pages) {
      return new Map<string, SnapshotImage[]>();
    }
    const allImages = data.pages.flatMap(page => page[0].images);
    const groups = new Map<string, SnapshotImage[]>();
    for (const image of allImages) {
      const name = image.display_name ?? image.image_file_name;
      const existing = groups.get(name);
      if (existing) {
        existing.push(image);
      } else {
        groups.set(name, [image]);
      }
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [data?.pages]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) {
      return groupedImages;
    }
    const query = searchQuery.toLowerCase();
    const filtered = new Map<string, SnapshotImage[]>();
    for (const [name, images] of groupedImages) {
      if (name.toLowerCase().includes(query)) {
        filtered.set(name, images);
      }
    }
    return filtered;
  }, [groupedImages, searchQuery]);

  // Default to first group if nothing selected or selection no longer in filtered results
  const currentGroupName =
    selectedGroupName && filteredGroups.has(selectedGroupName)
      ? selectedGroupName
      : (filteredGroups.keys().next().value ?? null);
  const currentGroupImages = currentGroupName
    ? (filteredGroups.get(currentGroupName) ?? [])
    : [];

  const handleSelectGroupName = (name: string) => {
    setSelectedGroupName(name);
    setVariantIndex(0);
  };

  if (isPending) {
    return (
      <SentryDocumentTitle title={t('Snapshot')}>
        <Layout.Page>
          <Flex align="center" justify="center" padding="3xl">
            <LoadingIndicator />
          </Flex>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  if (isError || !firstPageData) {
    return (
      <SentryDocumentTitle title={t('Snapshot')}>
        <Layout.Page>
          <Flex align="center" justify="center" padding="3xl">
            <Text variant="muted">{t('Unable to load snapshot data.')}</Text>
          </Flex>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={t('Snapshot')}>
      <Layout.Page>
        <Layout.Header>
          <SnapshotHeaderContent projectId={projectId} data={firstPageData} />
        </Layout.Header>
        <Flex direction="row" gap="0" height="100%" width="100%">
          <SnapshotSidebarContent
            filteredGroups={filteredGroups}
            currentGroupName={currentGroupName}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectGroupName={handleSelectGroupName}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
          <Separator orientation="vertical" />
          <SnapshotMainContent
            currentGroupName={currentGroupName}
            currentGroupImages={currentGroupImages}
            variantIndex={variantIndex}
            onVariantChange={setVariantIndex}
            organizationSlug={organization.slug}
            projectSlug={projectSlug}
          />
        </Flex>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
