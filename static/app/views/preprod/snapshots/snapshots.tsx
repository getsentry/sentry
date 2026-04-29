import {useCallback, useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {TopBar} from 'sentry/views/navigation/topBar';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {BuildProcessing} from 'sentry/views/preprod/components/buildProcessing';
import {ComparisonState, DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';
import type {
  SidebarItem,
  SnapshotDetailsApiResponse,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotHeaderActions} from './header/snapshotHeaderActions';
import {SnapshotHeaderContent} from './header/snapshotHeaderContent';
import type {DiffMode} from './main/imageDisplay/diffImageDisplay';
import {SnapshotMainContent, type ViewMode} from './main/snapshotMainContent';
import {DIFF_TYPE_ORDER, SnapshotSidebarContent} from './sidebar/snapshotSidebarContent';

function imageGroupKey(img: SnapshotImage): string {
  return img.group ?? img.image_file_name;
}

function groupByKey<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function itemVariantCount(item: SidebarItem): number {
  return item.type === 'changed' || item.type === 'renamed'
    ? item.pairs.length
    : item.images.length;
}

function snapshotKeyAt(item: SidebarItem, variantIdx: number): string | null {
  if (item.type === 'changed' || item.type === 'renamed') {
    return item.pairs[variantIdx]?.head_image.image_file_name ?? null;
  }
  return item.images[variantIdx]?.image_file_name ?? null;
}

function findSnapshotPosition(
  items: SidebarItem[],
  snapshotKey: string
): {itemIdx: number; variantIdx: number} | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const variantIdx =
      item.type === 'changed' || item.type === 'renamed'
        ? item.pairs.findIndex(p => p.head_image.image_file_name === snapshotKey)
        : item.images.findIndex(img => img.image_file_name === snapshotKey);
    if (variantIdx !== -1) {
      return {itemIdx: i, variantIdx};
    }
  }
  return null;
}

function itemMaxDiff(item: SidebarItem): number {
  if (item.type === 'changed') {
    let max = 0;
    for (const p of item.pairs) {
      if (p.diff !== null && p.diff > max) {
        max = p.diff;
      }
    }
    return max;
  }
  return 0;
}

export default function SnapshotsPage() {
  const organization = useOrganization();
  const theme = useTheme();
  const {snapshotId} = useParams<{
    snapshotId: string;
  }>();

  const snapshotApiUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/preprodartifacts/snapshots/$snapshotId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        snapshotId,
      },
    }
  );

  const {data, isPending, isError} = useApiQuery<SnapshotDetailsApiResponse>(
    [snapshotApiUrl],
    {
      staleTime: 0,
      enabled: !!snapshotId,
      // Skip retries on 4xx so error pages render instantly
      retry: (count, err) => count < 3 && (!err?.status || err.status >= 500),
      refetchInterval: query => {
        const state = query.state.data?.[0]?.comparison_run_info?.state;
        return state === ComparisonState.PENDING || state === ComparisonState.PROCESSING
          ? 5_000
          : false;
      },
    }
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useQueryState('selectedGroup', parseAsString);
  const [variantIndex, setVariantIndex] = useState(0);
  const palette = theme.chart.getColorPalette(10);
  const [overlayColor, setOverlayColor] = useLocalStorageState<string>(
    'snapshot-overlay-color',
    palette.at(-5) ?? palette[0]
  );
  const [diffMode, setDiffMode] = useLocalStorageState<DiffMode>(
    'snapshot-diff-mode',
    'split'
  );
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(
    'snapshot-view-mode',
    'list'
  );
  const [activeStatusList, setActiveStatusList] = useQueryState(
    'selectedTypes',
    parseAsArrayOf(parseAsStringLiteral(Object.values(DiffStatus))).withDefault([])
  );
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useQueryState(
    'selectedSnapshot',
    parseAsString
  );
  const [sortBy, setSortBy] = useQueryState(
    'sortBy',
    parseAsStringLiteral(['diff', 'alpha'] as const).withDefault('diff')
  );
  const activeStatuses = useMemo(() => new Set(activeStatusList), [activeStatusList]);

  const handleToggleStatus = useCallback(
    (status: DiffStatus) => {
      setActiveStatusList(prev =>
        prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
      );
    },
    [setActiveStatusList]
  );

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
    const {view: _view, selectedGroup: _sg, ...restQuery} = location.query;
    if (isSoloView) {
      navigate({...location, query: restQuery}, {replace: true});
    } else {
      navigate({...location, query: {...restQuery, view: 'solo'}}, {replace: true});
    }
  }, [location, navigate, isSoloView]);

  const sidebarItems = useMemo(() => {
    if (!data) {
      return [];
    }

    if (comparisonType === 'diff') {
      const items: SidebarItem[] = [];

      const pushDiffPairs = (pairs: SnapshotDiffPair[], type: 'changed' | 'renamed') => {
        for (const [groupKey, groupedPairs] of groupByKey(pairs, p =>
          imageGroupKey(p.head_image)
        )) {
          items.push({
            type,
            key: `${type}:${groupKey}`,
            name: groupKey,
            pairs: groupedPairs,
          });
        }
      };

      const pushImages = (
        imgs: SnapshotImage[],
        type: 'added' | 'removed' | 'unchanged'
      ) => {
        for (const [groupKey, images] of groupByKey(imgs, imageGroupKey)) {
          items.push({type, key: `${type}:${groupKey}`, name: groupKey, images});
        }
      };

      pushDiffPairs(data.changed, 'changed');
      pushDiffPairs(data.renamed ?? [], 'renamed');
      pushImages(data.added, 'added');
      pushImages(data.removed, 'removed');
      pushImages(data.unchanged, 'unchanged');

      items.sort(
        (a, b) => (DIFF_TYPE_ORDER[a.type] ?? 99) - (DIFF_TYPE_ORDER[b.type] ?? 99)
      );

      return items;
    }

    return [...groupByKey(data.images, imageGroupKey).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, images]) => ({
        type: 'solo' as const,
        key: `solo:${groupKey}`,
        name: groupKey,
        images,
      }));
  }, [data, comparisonType]);

  // Pre-computed lowercase text per image/pair for fast substring search filtering
  const memberSearchKeys = useMemo(
    () => sidebarItems.map(buildMemberSearchKeys),
    [sidebarItems]
  );

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredActiveStatuses = useDeferredValue(activeStatuses);

  const filteredItems = useMemo(() => {
    const trimmedQuery = deferredSearchQuery.trim().toLowerCase();
    const hasStatusFilter = deferredActiveStatuses.size > 0;
    const base: SidebarItem[] = [];
    for (let i = 0; i < sidebarItems.length; i++) {
      const item = sidebarItems[i]!;
      if (hasStatusFilter && !deferredActiveStatuses.has(item.type as DiffStatus)) {
        continue;
      }
      if (!trimmedQuery) {
        base.push(item);
        continue;
      }
      const narrowed = narrowItemBySearch(item, memberSearchKeys[i]!, trimmedQuery);
      if (narrowed) {
        base.push(narrowed);
      }
    }

    if (sortBy === 'alpha') {
      return base.sort((a, b) => a.name.localeCompare(b.name));
    }
    return base.sort((a, b) => {
      const diffA = itemMaxDiff(a);
      const diffB = itemMaxDiff(b);
      if (diffA !== diffB) {
        return diffB - diffA;
      }
      return (DIFF_TYPE_ORDER[a.type] ?? 99) - (DIFF_TYPE_ORDER[b.type] ?? 99);
    });
  }, [
    sidebarItems,
    memberSearchKeys,
    deferredSearchQuery,
    deferredActiveStatuses,
    sortBy,
  ]);

  const isAllSelected = selectedGroup === null;
  // If the user has a selectedGroup but filters hide it, return null rather
  // than silently falling back to filteredItems[0] — that would display an
  // item the user never picked while their URL param still points elsewhere.
  const currentItem = selectedGroup
    ? (filteredItems.find(i => i.key === selectedGroup) ?? null)
    : (filteredItems[0] ?? null);
  const currentItemKey = currentItem?.key ?? null;

  const listItems = useMemo(() => {
    if (isAllSelected) {
      return filteredItems;
    }
    return currentItem ? [currentItem] : [];
  }, [isAllSelected, filteredItems, currentItem]);

  const statusCounts = useMemo<Record<DiffStatus, number> | null>(() => {
    if (comparisonType !== 'diff') {
      return null;
    }
    const counts = {
      [DiffStatus.CHANGED]: 0,
      [DiffStatus.ADDED]: 0,
      [DiffStatus.REMOVED]: 0,
      [DiffStatus.RENAMED]: 0,
      [DiffStatus.UNCHANGED]: 0,
    };
    for (const item of sidebarItems) {
      if (item.type in counts) {
        counts[item.type as DiffStatus]++;
      }
    }
    return counts;
  }, [sidebarItems, comparisonType]);

  // Clamp variantIndex when the selected item changes implicitly (e.g. search
  // filtering selects a new item with fewer variants).
  const variantCount = currentItem ? itemVariantCount(currentItem) : 0;
  const safeVariantIndex =
    variantCount > 0 ? Math.min(variantIndex, variantCount - 1) : 0;

  const handleSelectItem = (name: string) => {
    setSelectedGroup(name);
    setVariantIndex(0);
  };

  const handleSelectAll = () => {
    setSelectedGroup(null);
    setVariantIndex(0);
  };

  // Scoped to listItems (not sidebarItems) so up/down nav only walks the
  // snapshots currently visible to the user. Falls back to currentItem +
  // variantIndex when selectedSnapshotKey can't be resolved.
  const singleViewPosition = useMemo(() => {
    if (selectedSnapshotKey) {
      const pos = findSnapshotPosition(listItems, selectedSnapshotKey);
      if (pos) {
        return pos;
      }
    }
    if (!currentItem) {
      return null;
    }
    const itemIdx = listItems.findIndex(i => i.key === currentItem.key);
    if (itemIdx === -1) {
      return null;
    }
    return {itemIdx, variantIdx: safeVariantIndex};
  }, [selectedSnapshotKey, listItems, currentItem, safeVariantIndex]);

  const navigateSingleView = useCallback(
    (direction: 'prev' | 'next') => {
      if (!singleViewPosition) {
        return;
      }
      const {itemIdx: currentItemIdx, variantIdx: currentVariantIdx} = singleViewPosition;
      let nextItemIdx = currentItemIdx;
      let nextVariantIdx = currentVariantIdx;
      if (direction === 'next') {
        const variantCountHere = itemVariantCount(listItems[currentItemIdx]!);
        if (currentVariantIdx + 1 < variantCountHere) {
          nextVariantIdx = currentVariantIdx + 1;
        } else if (currentItemIdx + 1 < listItems.length) {
          nextItemIdx = currentItemIdx + 1;
          nextVariantIdx = 0;
        }
      } else if (currentVariantIdx > 0) {
        nextVariantIdx = currentVariantIdx - 1;
      } else if (currentItemIdx > 0) {
        nextItemIdx = currentItemIdx - 1;
        nextVariantIdx = itemVariantCount(listItems[nextItemIdx]!) - 1;
      }
      if (nextItemIdx === currentItemIdx && nextVariantIdx === currentVariantIdx) {
        return;
      }
      const nextItem = listItems[nextItemIdx]!;
      const nextSnapshotKey = snapshotKeyAt(nextItem, nextVariantIdx);
      if (nextSnapshotKey) {
        setSelectedSnapshotKey(nextSnapshotKey);
      }
    },
    [listItems, singleViewPosition, setSelectedSnapshotKey]
  );

  const singleViewNav = useMemo(() => {
    if (!singleViewPosition) {
      return {canPrev: false, canNext: false};
    }
    const {itemIdx, variantIdx} = singleViewPosition;
    const item = listItems[itemIdx];
    if (!item) {
      return {canPrev: false, canNext: false};
    }
    const total = itemVariantCount(item);
    return {
      canPrev: variantIdx > 0 || itemIdx > 0,
      canNext: variantIdx + 1 < total || itemIdx + 1 < listItems.length,
    };
  }, [listItems, singleViewPosition]);

  // Ref so the keydown handler reads latest state without re-registering.
  const navRef = useRef({navigateSingleView, setViewMode, viewMode});
  navRef.current = {navigateSingleView, setViewMode, viewMode};

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight'
      ) {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      // Left/Right flip between single and list view.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const nextMode = e.key === 'ArrowLeft' ? 'single' : 'list';
        if (nextMode !== navRef.current.viewMode) {
          e.preventDefault();
          navRef.current.setViewMode(nextMode);
        }
        return;
      }

      // Up/Down only in single view — list view has its own handler.
      if (navRef.current.viewMode !== 'single') {
        return;
      }
      e.preventDefault();
      navRef.current.navigateSingleView(e.key === 'ArrowDown' ? 'next' : 'prev');
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Defer the item passed to main content so the sidebar stays responsive
  // while the expensive image rendering catches up.
  const deferredItem = useDeferredValue(currentItem);

  const singleViewItem =
    viewMode === 'single' && singleViewPosition
      ? (listItems[singleViewPosition.itemIdx] ?? deferredItem)
      : deferredItem;
  const singleViewVariantIndex =
    viewMode === 'single' && singleViewPosition
      ? singleViewPosition.variantIdx
      : safeVariantIndex;

  const isComparisonProcessing =
    !!comparisonRunInfo?.state &&
    [ComparisonState.PENDING, ComparisonState.PROCESSING].includes(
      comparisonRunInfo.state
    );

  const imageBaseUrl = `/api/0/projects/${organization.slug}/${data?.project_id ?? ''}/files/images/`;
  const diffImageBaseUrl = imageBaseUrl;

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
          totalItemCount={filteredItems.length}
          currentItemKey={currentItemKey}
          isAllSelected={isAllSelected}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          statusCounts={statusCounts}
          activeStatuses={activeStatuses}
          onToggleStatus={handleToggleStatus}
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
          selectedItem={singleViewItem}
          variantIndex={singleViewVariantIndex}
          imageBaseUrl={imageBaseUrl}
          diffImageBaseUrl={diffImageBaseUrl}
          overlayColor={overlayColor}
          onOverlayColorChange={setOverlayColor}
          diffMode={diffMode}
          onDiffModeChange={setDiffMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          listItems={listItems}
          isSoloView={isSoloView}
          onToggleSoloView={handleToggleView}
          comparisonType={comparisonType}
          headBranch={data?.vcs_info?.head_ref}
          selectedSnapshotKey={selectedSnapshotKey}
          onSelectSnapshot={setSelectedSnapshotKey}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onNavigateSingleView={navigateSingleView}
          canNavigatePrev={singleViewNav.canPrev}
          canNavigateNext={singleViewNav.canNext}
        />
      </Flex>
    </Flex>
  );

  if (isPending) {
    return (
      <SentryDocumentTitle title={t('Snapshot')}>
        <Stack flex={1}>
          <Flex align="center" justify="center" padding="3xl">
            <LoadingIndicator />
          </Flex>
        </Stack>
      </SentryDocumentTitle>
    );
  }

  if (isError || !data) {
    return (
      <SentryDocumentTitle title={t('Snapshot')}>
        <Stack flex={1}>
          <BuildError
            title={t('Snapshot unavailable')}
            message={t(
              'This snapshot may have been deleted or you may not have access to it.'
            )}
          />
        </Stack>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={t('Snapshot')}>
      <Stack flex={1}>
        <SnapshotHeaderContent data={data} />
        <TopBar.Slot name="actions">
          <SnapshotHeaderActions
            data={data}
            organizationSlug={organization.slug}
            apiUrl={snapshotApiUrl}
          />
        </TopBar.Slot>

        {isComparisonProcessing ? processingContent : snapshotContent}
      </Stack>
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

function imageSearchKey(image: SnapshotImage): string {
  const parts: string[] = [];
  if (image.display_name) parts.push(image.display_name);
  if (image.image_file_name) parts.push(image.image_file_name);
  if (image.group) parts.push(image.group);
  return parts.join('\n').toLowerCase();
}

// Builds one lowercase search key per image/pair, joining all searchable metadata
function buildMemberSearchKeys(item: SidebarItem): string[] {
  const groupNameLower = item.name ? item.name.toLowerCase() : '';
  if (item.type === 'changed' || item.type === 'renamed') {
    return item.pairs.map(pair => {
      const head = imageSearchKey(pair.head_image);
      const base = imageSearchKey(pair.base_image);
      return groupNameLower ? `${groupNameLower}\n${head}\n${base}` : `${head}\n${base}`;
    });
  }
  return item.images.map(image => {
    const h = imageSearchKey(image);
    return groupNameLower ? `${groupNameLower}\n${h}` : h;
  });
}

function narrowItemBySearch(
  item: SidebarItem,
  memberSearchKeysForItem: string[],
  query: string
): SidebarItem | null {
  if (item.type === 'changed' || item.type === 'renamed') {
    const kept: SnapshotDiffPair[] = [];
    let allMatched = true;
    for (let i = 0; i < item.pairs.length; i++) {
      if (memberSearchKeysForItem[i]!.includes(query)) {
        kept.push(item.pairs[i]!);
      } else {
        allMatched = false;
      }
    }
    if (kept.length === 0) return null;
    if (allMatched) return item;
    return {...item, pairs: kept};
  }
  const kept: SnapshotImage[] = [];
  let allMatched = true;
  for (let i = 0; i < item.images.length; i++) {
    if (memberSearchKeysForItem[i]!.includes(query)) {
      kept.push(item.images[i]!);
    } else {
      allMatched = false;
    }
  }
  if (kept.length === 0) return null;
  if (allMatched) return item;
  return {...item, images: kept};
}
