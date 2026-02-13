import {useMemo, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
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

  const {data, isLoading, isError} = useApiQuery<SnapshotDetailsApiResponse>(
    [
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
      {query: {limit: 100}},
    ],
    {
      staleTime: 0,
      enabled: !!projectSlug && !!snapshotId,
    }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);

  const groupedImages = useMemo(() => {
    if (!data?.images) {
      return new Map<string, SnapshotImage[]>();
    }
    const groups = new Map<string, SnapshotImage[]>();
    for (const image of data.images) {
      const name = image.file_name ?? 'Untitled';
      const existing = groups.get(name);
      if (existing) {
        existing.push(image);
      } else {
        groups.set(name, [image]);
      }
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [data?.images]);

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
  const activeName =
    selectedName && filteredGroups.has(selectedName)
      ? selectedName
      : (filteredGroups.keys().next().value ?? null);
  const activeImages = activeName ? (filteredGroups.get(activeName) ?? []) : [];
  const activeImage = activeImages[variantIndex] ?? null;

  const handleSelectName = (name: string) => {
    setSelectedName(name);
    setVariantIndex(0);
  };

  if (isLoading) {
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

  if (isError || !data) {
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
          <SnapshotHeaderContent projectId={projectId} data={data} />
        </Layout.Header>
        <Flex direction="row" gap="0" height="100%" width="100%">
          <SnapshotSidebarContent
            filteredGroups={filteredGroups}
            activeName={activeName}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectName={handleSelectName}
          />
          <Separator orientation="vertical" />
          <SnapshotMainContent
            activeName={activeName}
            activeImage={activeImage}
            activeImages={activeImages}
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
