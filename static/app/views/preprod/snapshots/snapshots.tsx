import {useCallback, useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
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
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {BuildProcessing} from 'sentry/views/preprod/components/buildProcessing';
import {ComparisonState, getImageGroup} from 'sentry/views/preprod/types/snapshotTypes';
import type {
  SidebarItem,
  SnapshotDetailsApiResponse,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';
import {computeSidebarBadges} from 'sentry/views/preprod/utils/sidebarUtils';

import {SnapshotDevTools} from './header/snapshotDevTools';
import {SnapshotHeaderContent} from './header/snapshotHeaderContent';
import type {DiffMode} from './main/imageDisplay/diffImageDisplay';
import {SnapshotMainContent} from './main/snapshotMainContent';
import {SECTION_ORDER, SnapshotSidebarContent} from './sidebar/snapshotSidebarContent';

const DIFF_TYPE_ORDER: Record<string, number> = Object.fromEntries(
  SECTION_ORDER.map((section, i) => [section.type, i])
);

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
      refetchInterval: query => {
        const state = query.state.data?.[0]?.comparison_run_info?.state;
        return state === ComparisonState.PENDING || state === ComparisonState.PROCESSING
          ? 5_000
          : false;
      },
    }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
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

  const location = useLocation();
  const navigate = useNavigate();
  const viewOverride = location.query.view;
  const comparisonType =
    viewOverride === 'solo' ? 'solo' : (data?.comparison_type ?? 'solo');
  const comparisonRunInfo = data?.comparison_run_info;

  const isSoloView = comparisonType === 'solo';
  const handleToggleView = useCallback(() => {
    const {view: _view, ...restQuery} = location.query;
    if (isSoloView) {
      navigate({...location, query: restQuery}, {replace: true});
    } else {
      navigate({...location, query: {...location.query, view: 'solo'}}, {replace: true});
    }
  }, [location, navigate, isSoloView]);

  const sidebarItems = useMemo(() => {
    if (!data) {
      return [];
    }

    if (comparisonType === 'diff') {
      const items: SidebarItem[] = [];

      const groupDiffPairs = (pairs: SnapshotDiffPair[], type: 'changed' | 'renamed') => {
        const groups = new Map<string, SnapshotDiffPair[]>();
        for (const pair of pairs) {
          const group = getImageGroup(pair.head_image);
          const existing = groups.get(group);
          if (existing) {
            existing.push(pair);
          } else {
            groups.set(group, [pair]);
          }
        }
        for (const [groupKey, groupedPairs] of groups) {
          const label =
            groupedPairs[0]!.head_image.group ??
            groupedPairs[0]!.head_image.display_name ??
            groupedPairs[0]!.head_image.image_file_name;
          items.push({
            type,
            key: `${type}:${groupKey}`,
            name: label,
            badge: null,
            pairs: groupedPairs,
          });
        }
      };

      const groupImages = (
        imgs: SnapshotImage[],
        type: 'added' | 'removed' | 'unchanged'
      ) => {
        const groups = new Map<string, SnapshotImage[]>();
        for (const img of imgs) {
          const group = getImageGroup(img);
          const existing = groups.get(group);
          if (existing) {
            existing.push(img);
          } else {
            groups.set(group, [img]);
          }
        }
        for (const [groupKey, images] of groups) {
          const label =
            images[0]!.group ?? images[0]!.display_name ?? images[0]!.image_file_name;
          items.push({
            type,
            key: `${type}:${groupKey}`,
            name: label,
            badge: null,
            images,
          });
        }
      };

      groupDiffPairs(data.changed, 'changed');
      groupDiffPairs(data.renamed ?? [], 'renamed');
      groupImages(data.added, 'added');
      groupImages(data.removed, 'removed');
      groupImages(data.unchanged, 'unchanged');

      items.sort(
        (a, b) => (DIFF_TYPE_ORDER[a.type] ?? 99) - (DIFF_TYPE_ORDER[b.type] ?? 99)
      );

      computeSidebarBadges(items);
      return items;
    }

    const groups = new Map<string, SnapshotImage[]>();
    for (const image of data.images) {
      const group = getImageGroup(image);
      const existing = groups.get(group);
      if (existing) {
        existing.push(image);
      } else {
        groups.set(group, [image]);
      }
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, images]) => {
        const label =
          images[0]!.group ?? images[0]!.display_name ?? images[0]!.image_file_name;
        return {
          type: 'solo' as const,
          key: `solo:${groupKey}`,
          name: label,
          badge: images.length > 1 ? String(images.length) : null,
          images,
        };
      });
  }, [data, comparisonType]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return sidebarItems;
    }
    const query = searchQuery.toLowerCase();
    return sidebarItems.filter(item => item.name.toLowerCase().includes(query));
  }, [sidebarItems, searchQuery]);

  const currentItem =
    (selectedItemKey && filteredItems.find(i => i.key === selectedItemKey)) ||
    filteredItems[0] ||
    null;
  const currentItemKey = currentItem?.key ?? null;

  // Clamp variantIndex to valid range when the selected item changes implicitly
  // (e.g. search filtering selects a new item with fewer variants)
  const variantCount = currentItem
    ? currentItem.type === 'changed' || currentItem.type === 'renamed'
      ? currentItem.pairs.length
      : currentItem.images.length
    : 0;
  const safeVariantIndex =
    variantCount > 0 ? Math.min(variantIndex, variantCount - 1) : 0;

  const handleSelectItem = (name: string) => {
    setSelectedItemKey(name);
    setVariantIndex(0);
  };

  // Ref so the keydown handler reads current state without re-registering
  const stateRef = useRef({
    filteredItems,
    currentItemKey,
    safeVariantIndex,
    variantCount,
  });
  stateRef.current = {
    filteredItems,
    currentItemKey,
    safeVariantIndex,
    variantCount,
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      e.preventDefault();

      const state = stateRef.current;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (state.variantCount <= 1) {
          return;
        }
        const next =
          e.key === 'ArrowRight'
            ? Math.min(state.safeVariantIndex + 1, state.variantCount - 1)
            : Math.max(state.safeVariantIndex - 1, 0);
        if (next !== state.safeVariantIndex) {
          setVariantIndex(next);
        }
        return;
      }

      const currentIndex = state.filteredItems.findIndex(
        i => i.key === state.currentItemKey
      );
      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, state.filteredItems.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex !== currentIndex && state.filteredItems[nextIndex]) {
        setSelectedItemKey(state.filteredItems[nextIndex].key);
        setVariantIndex(0);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Defer the item passed to main content so the sidebar stays responsive
  // while the expensive image rendering catches up
  const deferredItem = useDeferredValue(currentItem);

  const isComparisonProcessing =
    !!comparisonRunInfo?.state &&
    [ComparisonState.PENDING, ComparisonState.PROCESSING].includes(
      comparisonRunInfo.state
    );

  const imageBaseUrl = `/api/0/projects/${organization.slug}/${data?.project_id ?? ''}/files/images/`;
  const diffImageBaseUrl = data
    ? `/api/0/organizations/${organization.slug}/objectstore/v1/objects/preprod/org=${organization.id};project=${data.project_id}/${organization.id}/${data.project_id}/`
    : '';

  const processingContent = (
    <Flex width="100%" justify="center" align="center">
      <BuildProcessing
        title={t('Generating snapshot comparison')}
        message={t('Hang tight, this may take a few minutes...')}
      />
    </Flex>
  );

  const snapshotContent = (
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
          currentItemKey={currentItemKey}
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
  );

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
          <SnapshotHeaderContent
            data={data}
            isSoloView={isSoloView}
            onToggleView={handleToggleView}
          />
          <Layout.HeaderActions>
            <SnapshotDevTools
              organizationSlug={organization.slug}
              snapshotId={snapshotId}
              comparisonRunInfo={comparisonRunInfo}
              hasBaseArtifact={data.base_artifact_id !== null}
              refetch={refetch}
              isSoloView={isSoloView}
              onToggleView={handleToggleView}
            />
          </Layout.HeaderActions>
        </Layout.Header>

        {isComparisonProcessing ? processingContent : snapshotContent}
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
