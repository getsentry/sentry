import {useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {getImageName} from 'sentry/views/preprod/types/snapshotTypes';
import type {
  SidebarItem,
  SnapshotDetailsApiResponse,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotDevTools} from './header/snapshotDevTools';
import {SnapshotHeaderContent} from './header/snapshotHeaderContent';
import type {DiffMode} from './main/imageDisplay/diffImageDisplay';
import {SnapshotMainContent} from './main/snapshotMainContent';
import {SnapshotSidebarContent} from './sidebar/snapshotSidebarContent';

export default function SnapshotsPage() {
  const organization = useOrganization();
  const theme = useTheme();
  const {snapshotId} = useParams<{
    snapshotId: string;
  }>();

  const {
    data,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteApiQuery<SnapshotDetailsApiResponse>({
    queryKey: [
      'infinite',
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            snapshotId,
          },
        }
      ),
      {query: {per_page: 20}},
    ],
    staleTime: 0,
    enabled: !!snapshotId,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayColor, setOverlayColor] = useState(
    () => theme.chart.getColorPalette(10)[0]
  );
  const [diffMode, setDiffMode] = useState<DiffMode>('split');

  const {
    size: sidebarWidth,
    isHeld,
    onMouseDown,
    onDoubleClick,
  } = useResizableDrawer({
    direction: 'left',
    initialSize: 350,
    min: 200,
    onResize: () => {},
    sizeStorageKey: 'snapshot-sidebar-width',
  });

  const firstPageData = data?.pages[0]?.[0];
  const comparisonType = firstPageData?.comparison_type ?? 'solo';
  const comparisonRunInfo = firstPageData?.comparison_run_info;

  const sidebarItems = useMemo(() => {
    if (!data?.pages) {
      return [];
    }

    if (comparisonType === 'diff' && firstPageData) {
      const items: SidebarItem[] = [];

      for (const pair of firstPageData.changed) {
        items.push({type: 'changed', name: getImageName(pair.head_image), pair});
      }
      for (const img of firstPageData.added) {
        items.push({type: 'added', name: getImageName(img), image: img});
      }
      for (const img of firstPageData.removed) {
        items.push({type: 'removed', name: getImageName(img), image: img});
      }
      for (const img of firstPageData.renamed ?? []) {
        items.push({type: 'renamed', name: getImageName(img), image: img});
      }
      for (const img of firstPageData.unchanged) {
        items.push({type: 'unchanged', name: getImageName(img), image: img});
      }

      return items;
    }

    const allImages = data.pages.flatMap(page => page[0].images);
    const groups = new Map<string, SnapshotImage[]>();
    for (const image of allImages) {
      const name = getImageName(image);
      const existing = groups.get(name);
      if (existing) {
        existing.push(image);
      } else {
        groups.set(name, [image]);
      }
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, images]) => ({type: 'solo' as const, name, images}));
  }, [data?.pages, comparisonType, firstPageData]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return sidebarItems;
    }
    const query = searchQuery.toLowerCase();
    return sidebarItems.filter(item => item.name.toLowerCase().includes(query));
  }, [sidebarItems, searchQuery]);

  const currentItemName =
    selectedItemName && filteredItems.some(i => i.name === selectedItemName)
      ? selectedItemName
      : (filteredItems[0]?.name ?? null);
  const currentItem = filteredItems.find(i => i.name === currentItemName) ?? null;

  useEffect(() => {
    setVariantIndex(0);
  }, [currentItemName]);

  const handleSelectItem = (name: string) => {
    setSelectedItemName(name);
    setVariantIndex(0);
  };

  const imageBaseUrl = `/api/0/projects/${organization.slug}/${firstPageData?.project_id ?? ''}/files/images/`;
  const diffImageBaseUrl = firstPageData
    ? `/api/0/organizations/${organization.slug}/objectstore/v1/objects/preprod/org=${organization.id};project=${firstPageData.project_id}/${organization.id}/${firstPageData.project_id}/`
    : '';

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
          <SnapshotHeaderContent
            projectId={firstPageData.project_id}
            data={firstPageData}
          />
          <Layout.HeaderActions>
            <SnapshotDevTools
              organizationSlug={organization.slug}
              snapshotId={snapshotId}
              comparisonRunInfo={comparisonRunInfo}
              hasBaseArtifact={firstPageData.base_artifact_id !== null}
              refetch={refetch}
            />
          </Layout.HeaderActions>
        </Layout.Header>

        <Flex direction="row" height="100%" width="100%" overflow="hidden">
          <Flex flexShrink={0} overflow="hidden" style={{width: sidebarWidth}}>
            <SnapshotSidebarContent
              items={filteredItems}
              currentItemName={currentItemName}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectItem={handleSelectItem}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
            />
          </Flex>
          <DragHandle
            data-is-held={isHeld}
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
          >
            <IconGrabbable size="sm" />
          </DragHandle>
          <Flex flex="1" minWidth={0} overflow="hidden">
            <SnapshotMainContent
              selectedItem={currentItem}
              variantIndex={variantIndex}
              onVariantChange={setVariantIndex}
              imageBaseUrl={imageBaseUrl}
              diffImageBaseUrl={diffImageBaseUrl}
              showOverlay={showOverlay}
              onShowOverlayChange={setShowOverlay}
              overlayColor={overlayColor}
              onOverlayColorChange={setOverlayColor}
              diffMode={diffMode}
              onDiffModeChange={setDiffMode}
            />
          </Flex>
        </Flex>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const DragHandle = styled('div')`
  display: grid;
  place-items: center;
  width: ${space(2)};
  height: 100%;
  cursor: ew-resize;
  user-select: inherit;
  background: ${p => p.theme.tokens.background.secondary};

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &[data-is-held='true'] {
    user-select: none;
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;
