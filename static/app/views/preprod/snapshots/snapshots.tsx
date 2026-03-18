import {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
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

  const {data, isPending, isError, refetch} = useApiQuery<SnapshotDetailsApiResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            snapshotId,
          },
        }
      ),
    ],
    {
      staleTime: 0,
      enabled: !!snapshotId,
    }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayColor, setOverlayColor] = useState<string>(() => {
    const palette = theme.chart.getColorPalette(10);
    return palette.at(-1) ?? '#67C800';
  });
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

  const comparisonType = data?.comparison_type ?? 'solo';
  const comparisonRunInfo = data?.comparison_run_info;

  const sidebarItems = useMemo(() => {
    if (!data) {
      return [];
    }

    if (comparisonType === 'diff') {
      const items: SidebarItem[] = [];

      for (const pair of data.changed) {
        items.push({type: 'changed', name: getImageName(pair.head_image), pair});
      }
      for (const img of data.added) {
        items.push({type: 'added', name: getImageName(img), image: img});
      }
      for (const img of data.removed) {
        items.push({type: 'removed', name: getImageName(img), image: img});
      }
      for (const img of data.renamed ?? []) {
        items.push({type: 'renamed', name: getImageName(img), image: img});
      }
      for (const img of data.unchanged) {
        items.push({type: 'unchanged', name: getImageName(img), image: img});
      }

      return items;
    }

    const groups = new Map<string, SnapshotImage[]>();
    for (const image of data.images) {
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
  }, [data, comparisonType]);

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

  // Clamp variantIndex to valid range when the selected item changes implicitly
  // (e.g. search filtering selects a new item with fewer variants)
  const safeVariantIndex =
    currentItem?.type === 'solo'
      ? Math.min(variantIndex, currentItem.images.length - 1)
      : variantIndex;

  const handleSelectItem = (name: string) => {
    setSelectedItemName(name);
    setVariantIndex(0);
  };

  // Ref so the keydown handler reads current state without re-registering
  const stateRef = useRef({filteredItems, currentItemName});
  stateRef.current = {filteredItems, currentItemName};

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      e.preventDefault();

      const {filteredItems: items, currentItemName: current} = stateRef.current;
      const currentIndex = items.findIndex(i => i.name === current);
      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, items.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex !== currentIndex && items[nextIndex]) {
        setSelectedItemName(items[nextIndex].name);
        setVariantIndex(0);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Defer the item passed to main content so the sidebar stays responsive
  // while the expensive image rendering catches up
  const deferredItem = useDeferredValue(currentItem);

  const imageBaseUrl = `/api/0/projects/${organization.slug}/${data?.project_id ?? ''}/files/images/`;
  const diffImageBaseUrl = data
    ? `/api/0/organizations/${organization.slug}/objectstore/v1/objects/preprod/org=${organization.id};project=${data.project_id}/${organization.id}/${data.project_id}/`
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
          <SnapshotHeaderContent projectId={data.project_id} data={data} />
          <Layout.HeaderActions>
            <SnapshotDevTools
              organizationSlug={organization.slug}
              snapshotId={snapshotId}
              comparisonRunInfo={comparisonRunInfo}
              hasBaseArtifact={data.base_artifact_id !== null}
              refetch={refetch}
            />
          </Layout.HeaderActions>
        </Layout.Header>

        <Flex
          direction="row"
          flex="1"
          minHeight="0"
          width="100%"
          overflow="hidden"
          style={{maxHeight: 'calc(100vh - 205px)'}}
        >
          <Flex flexShrink={0} overflow="auto" style={{width: sidebarWidth}}>
            <SnapshotSidebarContent
              items={filteredItems}
              totalItemCount={sidebarItems.length}
              currentItemName={currentItemName}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectItem={handleSelectItem}
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
              selectedItem={deferredItem}
              variantIndex={safeVariantIndex}
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
  width: ${p => p.theme.space.xl};
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
