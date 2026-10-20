import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {matchesHotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {t} from 'sentry/locale';
import {ModalStore} from 'sentry/stores/modalStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DiffStatus, isPairSidebarItem} from 'sentry/views/preprod/types/snapshotTypes';
import type {
  SidebarItem,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './imageDisplay/diffImageDisplay';
import {ImageCard, PairCard} from './snapshotCards';
import {MAX_IMAGE_HEIGHT} from './snapshotDiffBodies';
import {SnapshotGroupHeader} from './snapshotFrames';
import {RowFrame} from './snapshotRowFrame';
import {
  useViewedSnapshots,
  viewedKeyForImage,
  viewedKeyForPair,
} from './useViewedSnapshots';
import {TOGGLE_VIEWED_HOTKEY} from './viewedCheckbox';

interface SnapshotListViewProps {
  imageBaseUrl: string;
  items: SidebarItem[];
  diffImageBaseUrl?: string;
  diffMode?: DiffMode;
  headBranch?: string | null;
  onOpenSnapshot?: (key: string) => void;
  onScrollProgress?: (progress: number, firstVisibleIndex: number) => void;
  onSelectSnapshot?: (key: string | null) => void;
  onVisibleGroupChange?: (name: string | null) => void;
  overlayColor?: string;
  overlayOpacity?: number;
  ref?: React.Ref<SnapshotListViewHandle>;
  selectedSnapshotKey?: string | null;
}

function snapshotKeyFor(card: GroupCard): string {
  return card.type === 'pair-card'
    ? card.pair.head_image.image_file_name
    : card.image.image_file_name;
}

export function buildSnapshotLink(snapshotKey: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set('selectedSnapshot', snapshotKey);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

type GroupCard =
  | {
      estimatedHeight: number;
      id: string;
      pair: SnapshotDiffPair;
      status: DiffStatus;
      type: 'pair-card';
      viewedKey: string | null;
    }
  | {
      cardType: 'added' | 'removed' | 'renamed' | 'solo' | 'unchanged' | 'skipped';
      estimatedHeight: number;
      id: string;
      image: SnapshotImage;
      type: 'image-card';
      viewedKey: string | null;
      copyData?: unknown;
    };

// Keep in sync with SnapshotGroupHeader: lg vertical padding + md heading height.
const SNAPSHOT_GROUP_HEADER_HEIGHT = 44;
const CARD_CHROME_HEIGHT = 120;
const COLLAPSED_CARD_HEIGHT = 48;
const ERRORED_BANNER_HEIGHT = 56;
const ROW_PADDING_BOTTOM = 16;
const DEFAULT_CONTENT_WIDTH = 900;
const SNAPSHOT_FRAME_BORDER_WIDTH = 1;
const STICKY_HEADER_BOTTOM_OVERLAP = SNAPSHOT_FRAME_BORDER_WIDTH * 2;

function estimateCardHeight(
  image: SnapshotImage,
  splitColumns: boolean,
  contentWidth: number
) {
  const columnWidth = splitColumns ? contentWidth / 2 : contentWidth;
  const aspectHeight =
    image.width > 0 && image.height > 0
      ? image.width <= columnWidth
        ? image.height
        : (image.height / image.width) * columnWidth
      : MAX_IMAGE_HEIGHT;
  const imageBox = Math.min(aspectHeight, MAX_IMAGE_HEIGHT);
  return CARD_CHROME_HEIGHT + imageBox;
}

export function isItemUngrouped(item: SidebarItem): boolean {
  if (isPairSidebarItem(item)) {
    return !item.pairs[0]?.head_image.group;
  }
  return !item.images[0]?.group;
}

export type ListRow =
  | {
      estimatedHeight: number;
      groupName: string;
      hiddenCards: GroupCard[];
      id: string;
      isViewed: boolean | 'indeterminate';
      itemKey: string;
      kind: 'header';
      viewedKeys: string[];
    }
  | {
      card: GroupCard;
      estimatedHeight: number;
      groupName: string | null;
      id: string;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
      isUngrouped: boolean;
      isViewed: boolean;
      itemKey: string;
      kind: 'card';
    };

function buildItemCards(item: SidebarItem, contentWidth: number): GroupCard[] {
  const cards: GroupCard[] = [];
  if (item.type === 'changed' || item.type === 'errored') {
    const status = item.type === 'errored' ? DiffStatus.ERRORED : DiffStatus.CHANGED;
    const bannerHeight = status === DiffStatus.ERRORED ? ERRORED_BANNER_HEIGHT : 0;
    for (const pair of item.pairs) {
      cards.push({
        type: 'pair-card',
        id: `c:${item.key}:${pair.head_image.image_file_name}`,
        pair,
        status,
        viewedKey: viewedKeyForPair(pair),
        estimatedHeight:
          Math.max(
            estimateCardHeight(pair.head_image, true, contentWidth),
            estimateCardHeight(pair.base_image, true, contentWidth)
          ) + bannerHeight,
      });
    }
  } else if (item.type === 'renamed') {
    for (const pair of item.pairs) {
      cards.push({
        type: 'image-card',
        id: `c:${item.key}:${pair.head_image.image_file_name}`,
        image: pair.head_image,
        copyData: pair,
        cardType: item.type,
        viewedKey: viewedKeyForPair(pair),
        estimatedHeight: estimateCardHeight(pair.head_image, false, contentWidth),
      });
    }
  } else {
    for (const image of item.images) {
      cards.push({
        type: 'image-card',
        id: `c:${item.key}:${image.image_file_name}`,
        image,
        cardType: item.type,
        viewedKey: item.type === 'unchanged' ? null : viewedKeyForImage(image),
        estimatedHeight: estimateCardHeight(image, false, contentWidth),
      });
    }
  }
  return cards;
}

export function buildRows(
  items: SidebarItem[],
  contentWidth: number,
  viewed: Record<string, number> = {}
): ListRow[] {
  const rows: ListRow[] = [];
  for (const item of items) {
    const cards = buildItemCards(item, contentWidth);
    const ungrouped = isItemUngrouped(item);
    if (!ungrouped) {
      const viewedKeys = cards.flatMap(card =>
        card.viewedKey === null ? [] : [card.viewedKey]
      );
      const viewedCount = viewedKeys.filter(key => key in viewed).length;
      const isViewed =
        viewedCount === 0
          ? false
          : viewedCount === viewedKeys.length
            ? true
            : 'indeterminate';
      rows.push({
        kind: 'header',
        id: `h:${item.key}`,
        itemKey: item.key,
        groupName: item.name,
        viewedKeys,
        isViewed,
        hiddenCards: isViewed === true ? cards : [],
        estimatedHeight:
          SNAPSHOT_GROUP_HEADER_HEIGHT + (isViewed === true ? ROW_PADDING_BOTTOM : 0),
      });
      if (isViewed === true) {
        continue;
      }
    }
    cards.forEach((card, i) => {
      const isLast = i === cards.length - 1;
      const isViewed = card.viewedKey !== null && card.viewedKey in viewed;
      const cardHeight = isViewed ? COLLAPSED_CARD_HEIGHT : card.estimatedHeight;
      rows.push({
        kind: 'card',
        id: card.id,
        card,
        itemKey: item.key,
        groupName: ungrouped ? null : item.name,
        isUngrouped: ungrouped,
        isFirstInGroup: i === 0,
        isLastInGroup: isLast,
        isViewed,
        estimatedHeight: cardHeight + (isLast ? ROW_PADDING_BOTTOM : 0),
      });
    });
  }
  return rows;
}

export interface RowIndex {
  firstRowByItemKey: Map<string, number>;
  lastRowByItemKey: Map<string, number>;
  nextPositionByHiddenKey: Map<string, number>;
  order: string[];
  ordinalByKey: Map<string, number>;
  positionByKey: Map<string, number>;
  rowIndexByKey: Map<string, number>;
}

export function buildRowIndex(rows: ListRow[]): RowIndex {
  const order: string[] = [];
  const positionByKey = new Map<string, number>();
  const ordinalByKey = new Map<string, number>();
  const rowIndexByKey = new Map<string, number>();
  const nextPositionByHiddenKey = new Map<string, number>();
  const firstRowByItemKey = new Map<string, number>();
  const lastRowByItemKey = new Map<string, number>();
  let ordinal = 0;
  rows.forEach((row, rowIdx) => {
    if (!firstRowByItemKey.has(row.itemKey)) {
      firstRowByItemKey.set(row.itemKey, rowIdx);
    }
    lastRowByItemKey.set(row.itemKey, rowIdx);
    if (row.kind === 'card') {
      const key = snapshotKeyFor(row.card);
      positionByKey.set(key, order.length);
      ordinalByKey.set(key, ordinal++);
      order.push(key);
      rowIndexByKey.set(key, rowIdx);
      return;
    }
    for (const card of row.hiddenCards) {
      const key = snapshotKeyFor(card);
      nextPositionByHiddenKey.set(key, order.length);
      ordinalByKey.set(key, ordinal++);
      rowIndexByKey.set(key, rowIdx);
    }
  });
  return {
    order,
    positionByKey,
    ordinalByKey,
    rowIndexByKey,
    nextPositionByHiddenKey,
    firstRowByItemKey,
    lastRowByItemKey,
  };
}

function isGroupedRow(row: ListRow): boolean {
  return row.kind === 'header' || !row.isUngrouped;
}

export function rowFrameEdges(row: ListRow): {
  frameBottom: boolean;
  frameTop: boolean;
  separator: boolean;
} {
  if (row.kind === 'header') {
    return {frameTop: true, frameBottom: row.isViewed === true, separator: false};
  }
  return {
    frameTop: row.isFirstInGroup && row.isUngrouped,
    frameBottom: row.isLastInGroup,
    separator: !row.isLastInGroup,
  };
}

export interface SnapshotListViewHandle {
  scrollToGroup: (itemKey: string) => void;
}

export const SnapshotListView = memo(function SnapshotListViewImpl({
  items,
  imageBaseUrl,
  headBranch,
  selectedSnapshotKey,
  onSelectSnapshot,
  onOpenSnapshot,
  onScrollProgress,
  diffMode = 'split',
  overlayColor,
  overlayOpacity,
  diffImageBaseUrl,
  ref,
  onVisibleGroupChange,
}: SnapshotListViewProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const [contentWidth, setContentWidth] = useState(DEFAULT_CONTENT_WIDTH);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const style = getComputedStyle(el);
    setContentWidth(
      el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContentWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const {viewed, setViewed} = useViewedSnapshots();
  const rows = useMemo(
    () => buildRows(items, contentWidth, viewed),
    [items, contentWidth, viewed]
  );
  const getItemKey = useCallback((index: number) => rows[index]!.id, [rows]);

  const {totalSize, virtualItems, virtualizer} = useVirtualRows({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: i => rows[i]!.estimatedHeight,
    getItemKey,
    overscan: 8,
    scrollPaddingEnd: 8,
  });

  const rowIndex = useMemo(() => buildRowIndex(rows), [rows]);

  const previousRows = useRef(rows);
  const [viewedAnchorGroup, setViewedAnchorGroup] = useState<string | null>(null);
  const viewedScrollAnchor = useRef<{
    id: string;
    imageBaseUrl: string;
    itemKey: string;
    items: SidebarItem[];
    offset: number;
  } | null>(null);
  const anchorFrame = useRef<number | null>(null);
  const cancelViewedScroll = useCallback(() => {
    if (anchorFrame.current !== null) {
      cancelAnimationFrame(anchorFrame.current);
      anchorFrame.current = null;
    }
    viewedScrollAnchor.current = null;
    setViewedAnchorGroup(null);
    // oxlint-disable-next-line react/immutability
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
  }, [virtualizer]);

  const handleSetViewed = useCallback(
    (keys: string[], isViewed: boolean) => {
      cancelViewedScroll();
      const el = scrollRef.current;
      if (el) {
        const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
        const top = el.scrollTop - paddingTop;
        const visible = virtualizer.getVirtualItems();
        const first = visible.find(item => item.end > top);
        const firstRow = first && rows[first.index];
        const headerIsVisible = firstRow?.kind === 'header' && first!.start >= top;
        const stickyHeight =
          firstRow && isGroupedRow(firstRow) ? SNAPSHOT_GROUP_HEADER_HEIGHT : 0;
        const anchor = headerIsVisible
          ? first
          : visible.find(item => {
              const row = rows[item.index];
              return (
                item.end > top + stickyHeight &&
                (row?.kind === 'card' || row?.isViewed === true)
              );
            });
        if (anchor) {
          const anchorRow = rows[anchor.index]!;
          viewedScrollAnchor.current = {
            id: anchorRow.id,
            itemKey: anchorRow.itemKey,
            offset: anchor.start - top,
            items,
            imageBaseUrl,
          };
          if (el.scrollTop > 0 && isGroupedRow(anchorRow)) {
            setViewedAnchorGroup(anchorRow.itemKey);
          }
          // oxlint-disable-next-line react/immutability
          virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
        }
      }
      setViewed(keys, isViewed);
    },
    [cancelViewedScroll, virtualizer, rows, items, imageBaseUrl, setViewed]
  );

  const restoreViewedScroll = useCallback(() => {
    const anchor = viewedScrollAnchor.current;
    const el = scrollRef.current;
    if (!anchor || !el) {
      return;
    }
    const anchorIndex = rows.findIndex(row => row.id === anchor.id);
    const index =
      anchorIndex === -1
        ? (rowIndex.firstRowByItemKey.get(anchor.itemKey) ?? -1)
        : anchorIndex;
    if (anchor.items !== items || anchor.imageBaseUrl !== imageBaseUrl || index === -1) {
      cancelViewedScroll();
      return;
    }
    const row = rows[index]!;
    virtualizer.getTotalSize();
    const measurement = virtualizer.measurementsCache[index]!;
    const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const offset =
      anchorIndex === -1
        ? 0
        : row.kind === 'card' && row.isViewed
          ? Math.max(anchor.offset, row.isUngrouped ? 0 : SNAPSHOT_GROUP_HEADER_HEIGHT)
          : anchor.offset;
    const target = Math.max(
      0,
      Math.min(measurement.start + paddingTop - offset, el.scrollHeight - el.clientHeight)
    );
    if (Math.abs(el.scrollTop - target) > 1) {
      virtualizer.scrollToOffset(target, {behavior: 'auto'});
    }
    setScrollTop(el.scrollTop);
  }, [rows, rowIndex, items, imageBaseUrl, cancelViewedScroll, virtualizer]);

  useLayoutEffect(() => {
    if (previousRows.current !== rows) {
      const previous = new Map(previousRows.current.map(row => [row.id, row]));
      const previouslyHidden = new Set(
        previousRows.current.flatMap(row =>
          row.kind === 'header' ? row.hiddenCards.map(card => card.id) : []
        )
      );
      rows.forEach((row, index) => {
        const before = previous.get(row.id);
        if (
          previouslyHidden.has(row.id) ||
          (row.kind === 'card' && before && before.isViewed !== row.isViewed)
        ) {
          virtualizer.resizeItem(index, row.estimatedHeight);
        }
      });
      previousRows.current = rows;
    }
    for (const item of virtualItems) {
      const node = virtualizer.elementsCache.get(item.key);
      if (node instanceof HTMLElement && node.isConnected) {
        virtualizer.resizeItem(item.index, node.offsetHeight);
      }
    }
    if (totalSize !== virtualizer.getTotalSize()) {
      return;
    }
    restoreViewedScroll();
    if (viewedScrollAnchor.current && anchorFrame.current === null) {
      anchorFrame.current = requestAnimationFrame(() => {
        restoreViewedScroll();
        cancelViewedScroll();
      });
    }
  }, [
    rows,
    virtualItems,
    totalSize,
    virtualizer,
    restoreViewedScroll,
    cancelViewedScroll,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) {
      return;
    }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const event of events) {
      el.addEventListener(event, cancelViewedScroll, {passive: true});
    }
    return () => {
      for (const event of events) {
        el.removeEventListener(event, cancelViewedScroll);
      }
      cancelViewedScroll();
    };
  }, [cancelViewedScroll, items.length]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToGroup(itemKey: string) {
        cancelViewedScroll();
        const rowIdx = rowIndex.firstRowByItemKey.get(itemKey);
        if (rowIdx === undefined) {
          return;
        }
        virtualizer.scrollToIndex(rowIdx, {align: 'start'});
      },
    }),
    [rowIndex, virtualizer, cancelViewedScroll]
  );

  const rafId = useRef(0);
  const onVisibleGroupChangeRef = useRef(onVisibleGroupChange);
  // oxlint-disable-next-line react/refs
  onVisibleGroupChangeRef.current = onVisibleGroupChange;
  const onScrollProgressRef = useRef(onScrollProgress);
  // oxlint-disable-next-line react/refs
  onScrollProgressRef.current = onScrollProgress;
  const rowsRef = useRef(rows);
  // oxlint-disable-next-line react/refs
  rowsRef.current = rows;
  const rowIndexRef = useRef(rowIndex);
  // oxlint-disable-next-line react/refs
  rowIndexRef.current = rowIndex;
  const visibleRowIdxRef = useRef(0);
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) {
        return;
      }
      const top = el.scrollTop;
      setScrollTop(top);
      const virtualRows = virtualizer.getVirtualItems();

      const anchor = top - Number.parseFloat(theme.space.xl);

      const topRowItem = virtualRows.find(vi => vi.end > anchor) ?? virtualRows[0];
      visibleRowIdxRef.current = topRowItem?.index ?? 0;
      const topRow = topRowItem ? rowsRef.current[topRowItem.index] : undefined;
      onVisibleGroupChangeRef.current?.(topRow?.itemKey ?? null);

      if (onScrollProgressRef.current) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        const progress = maxScroll > 0 ? (top / maxScroll) * 100 : 0;
        const topCardItem = virtualRows.find(
          vi => vi.end > anchor && rowsRef.current[vi.index]?.kind === 'card'
        );
        const topCardRow = topCardItem ? rowsRef.current[topCardItem.index] : undefined;
        const key =
          topCardRow?.kind === 'card' ? snapshotKeyFor(topCardRow.card) : undefined;
        const ordinal = key ? (rowIndexRef.current.ordinalByKey.get(key) ?? 0) : 0;
        onScrollProgressRef.current(progress, ordinal);
      }
    });
  }, [virtualizer, theme.space.xl]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || rows.length === 0) {
      return;
    }
    el.addEventListener('scroll', handleScroll, {passive: true});
    handleScroll();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, [rows, handleScroll]);

  const prevDiffModeRef = useRef(diffMode);
  useEffect(() => {
    if (prevDiffModeRef.current === diffMode) {
      return;
    }
    prevDiffModeRef.current = diffMode;
    const idx = visibleRowIdxRef.current;
    if (idx >= 0 && idx < rows.length) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(idx, {align: 'start'});
      });
    }
  }, [diffMode, rows, virtualizer]);

  // oxlint-disable-next-line react/refs
  const initialSnapshotKey = useRef(selectedSnapshotKey ?? null).current;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || !initialSnapshotKey || rows.length === 0) {
      return;
    }
    const targetIdx = rowIndex.rowIndexByKey.get(initialSnapshotKey);
    if (targetIdx === undefined) {
      return;
    }
    didInitialScroll.current = true;
    virtualizer.scrollToIndex(targetIdx, {align: 'start'});

    const targetRow = rows[targetIdx];
    const isUngrouped = targetRow?.kind === 'card' ? targetRow.isUngrouped : true;

    let retries = 3;
    const adjustScroll = () => {
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-snapshot-key="${CSS.escape(initialSnapshotKey)}"]`
      );
      if (!el || !scrollRef.current) {
        // oxlint-disable-next-line react/todo
        if (retries-- > 0) {
          requestAnimationFrame(adjustScroll);
        }
        return;
      }
      el.scrollIntoView({block: 'start'});
      if (!isUngrouped) {
        scrollRef.current.scrollTop -= SNAPSHOT_GROUP_HEADER_HEIGHT;
      }
    };
    requestAnimationFrame(adjustScroll);
  }, [rows, initialSnapshotKey, rowIndex, virtualizer]);

  const keyNavRef = useRef({
    rowIndex,
    selectedSnapshotKey,
    onSelectSnapshot,
    onOpenSnapshot,
    virtualizer,
  });
  // oxlint-disable-next-line react/refs
  keyNavRef.current = {
    rowIndex,
    selectedSnapshotKey,
    onSelectSnapshot,
    onOpenSnapshot,
    virtualizer,
  };
  useEffect(() => {
    function scrollCardIntoView(key: string, block: ScrollLogicalPosition) {
      const cardEl = scrollRef.current?.querySelector<HTMLElement>(
        `[data-snapshot-key="${CSS.escape(key)}"]`
      );
      if (!cardEl) {
        return false;
      }
      cardEl.scrollIntoView({block});
      if (block === 'start') {
        const rowIdx = keyNavRef.current.rowIndex.rowIndexByKey.get(key);
        const row = rowIdx === undefined ? undefined : rowsRef.current[rowIdx];
        if (row?.kind === 'card' && !row.isUngrouped && scrollRef.current) {
          scrollRef.current.scrollTop -= SNAPSHOT_GROUP_HEADER_HEIGHT;
        }
      }
      return true;
    }

    function revealCard(key: string, block: ScrollLogicalPosition) {
      if (scrollCardIntoView(key, block)) {
        return;
      }
      const rowIdx = keyNavRef.current.rowIndex.rowIndexByKey.get(key);
      if (rowIdx === undefined) {
        return;
      }
      keyNavRef.current.virtualizer.scrollToIndex(rowIdx, {
        align: block === 'start' ? 'start' : 'auto',
      });
      requestAnimationFrame(() => scrollCardIntoView(key, block));
    }

    function focusList() {
      const el = scrollRef.current;
      if (el && !el.contains(document.activeElement)) {
        el.focus({preventScroll: true});
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== ' ' &&
        e.key !== 'Enter'
      ) {
        return;
      }
      if (typeof ModalStore.getState().renderer === 'function') {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) {
        return;
      }
      const {
        rowIndex: idx,
        selectedSnapshotKey: currentKey,
        onSelectSnapshot: onSelect,
        onOpenSnapshot: onOpen,
      } = keyNavRef.current;
      if (idx.order.length === 0) {
        return;
      }

      if (e.key === 'Enter') {
        if (currentKey && onOpen) {
          e.preventDefault();
          onOpen(currentKey);
        }
        return;
      }

      if (e.key === ' ') {
        if (!currentKey) {
          return;
        }
        e.preventDefault();
        revealCard(currentKey, 'start');
        return;
      }

      if (!onSelect) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const isUp = e.key === 'ArrowUp';
        const targetKey = isUp ? idx.order[0]! : idx.order[idx.order.length - 1]!;
        onSelect(targetKey);
        revealCard(targetKey, isUp ? 'start' : 'end');
        focusList();
        return;
      }

      const lastPos = idx.order.length - 1;
      const currentPos = currentKey ? (idx.positionByKey.get(currentKey) ?? -1) : -1;
      const hiddenNextPos = currentKey
        ? idx.nextPositionByHiddenKey.get(currentKey)
        : undefined;
      const isDown = e.key === 'ArrowDown';
      let nextPos: number;
      if (hiddenNextPos !== undefined) {
        nextPos = isDown ? hiddenNextPos : hiddenNextPos - 1;
      } else if (currentPos === -1) {
        nextPos = isDown ? 0 : lastPos;
      } else {
        nextPos = Math.max(0, Math.min(lastPos, currentPos + (isDown ? 1 : -1)));
      }
      e.preventDefault();
      if (nextPos === currentPos || nextPos < 0 || nextPos > lastPos) {
        return;
      }
      const nextKey = idx.order[nextPos]!;
      onSelect(nextKey);
      revealCard(nextKey, 'nearest');
      focusList();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollContainerPaddingTop = Number.parseFloat(theme.space.xl);
  const activeGroupThreshold = scrollTop - scrollContainerPaddingTop;
  const activeRowItem = virtualItems.find(virtualItem => {
    return scrollTop > 0 && activeGroupThreshold < virtualItem.end;
  });
  const activeRow = activeRowItem ? rows[activeRowItem.index] : undefined;
  const activeItemKey =
    viewedAnchorGroup ??
    (activeRow && isGroupedRow(activeRow) ? activeRow.itemKey : null);
  const activeHeaderRowIdx =
    activeItemKey === null ? undefined : rowIndex.firstRowByItemKey.get(activeItemKey);
  const activeHeaderRow =
    activeHeaderRowIdx === undefined ? undefined : rows[activeHeaderRowIdx];
  const measurements = virtualizer.measurementsCache;
  const activeGroupBounds = (() => {
    if (activeItemKey === null) {
      return null;
    }
    const firstIdx = rowIndex.firstRowByItemKey.get(activeItemKey);
    const lastIdx = rowIndex.lastRowByItemKey.get(activeItemKey);
    const first = firstIdx === undefined ? undefined : measurements[firstIdx];
    const last = lastIdx === undefined ? undefined : measurements[lastIdx];
    if (!first || !last) {
      return null;
    }
    return {
      top: scrollContainerPaddingTop + first.start - scrollTop,
      bottom: scrollContainerPaddingTop + last.end - ROW_PADDING_BOTTOM - scrollTop,
    };
  })();
  const stickyHeaderTop = Math.max(scrollContainerPaddingTop - scrollTop, 0);
  const stickyHeaderTranslateY =
    activeGroupBounds === null
      ? 0
      : Math.min(
          Math.max(0, activeGroupBounds.top - stickyHeaderTop),
          activeGroupBounds.bottom -
            (stickyHeaderTop + SNAPSHOT_GROUP_HEADER_HEIGHT) +
            STICKY_HEADER_BOTTOM_OVERLAP
        );
  // detached frame is to detect when the top of the active group has not yet hit the control container and needs top border styling
  const stickyHeaderHasDetachedFrame =
    scrollTop < scrollContainerPaddingTop || stickyHeaderTranslateY > 0;
  // bottom frame is to detect when the sticky header is near the bottom of the group container
  const stickyHeaderHasBottomFrame = stickyHeaderTranslateY < 0;
  const stickyHeaderStyle = {
    '--sticky-header-translate-y': `${stickyHeaderTranslateY}px`,
  } as React.CSSProperties;

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.repeat || !matchesHotkey(TOGGLE_VIEWED_HOTKEY, e.nativeEvent)) {
      return;
    }
    const rowIdx = selectedSnapshotKey
      ? rowIndex.rowIndexByKey.get(selectedSnapshotKey)
      : undefined;
    const row = rowIdx === undefined ? undefined : rows[rowIdx];
    if (row?.kind !== 'card' || row.card.viewedKey === null) {
      return;
    }
    e.preventDefault();
    handleSetViewed([row.card.viewedKey], !row.isViewed);
    trackImageViewedToggled(organization, row.card, !row.isViewed);
  };

  if (items.length === 0) {
    return (
      <Flex align="center" justify="center" padding="3xl" width="100%">
        <Text variant="muted">{t('No snapshots found.')}</Text>
      </Flex>
    );
  }

  return (
    <ScrollContainer
      ref={scrollRef}
      tabIndex={-1}
      onKeyDown={handleListKeyDown}
      position="relative"
      flex="1 1 0"
      minHeight="0"
      width="100%"
      overflowY="auto"
      overflowX="hidden"
      padding={{zero: 'xl 0', xl: 'xl', '3xl': 'xl xl xl 0'}}
      background="secondary"
      contain="layout"
      overscrollBehavior="contain"
    >
      {activeHeaderRow?.kind === 'header' ? (
        <StickyGroupHeader
          data-bottom-frame={stickyHeaderHasBottomFrame ? '' : undefined}
          data-detached-frame={stickyHeaderHasDetachedFrame ? '' : undefined}
          style={stickyHeaderStyle}
        >
          <GroupHeaderRow row={activeHeaderRow} onSetViewed={handleSetViewed} />
        </StickyGroupHeader>
      ) : null}
      <Container position="relative" width="100%" style={{height: totalSize}}>
        {virtualItems.map(vi => {
          const row = rows[vi.index]!;
          const {frameTop, frameBottom, separator} = rowFrameEdges(row);
          return (
            <RowPositioner
              key={vi.key}
              data-index={vi.index}
              data-last-in-group={frameBottom ? '' : undefined}
              ref={virtualizer.measureElement}
              style={{transform: `translateY(${vi.start}px)`}}
            >
              <RowFrame
                overflow="hidden"
                data-frame-top={frameTop ? '' : undefined}
                data-frame-bottom={frameBottom ? '' : undefined}
                data-separator={separator ? '' : undefined}
              >
                {row.kind === 'header' ? (
                  <GroupHeaderRow row={row} onSetViewed={handleSetViewed} />
                ) : (
                  <CardRow
                    row={row}
                    imageBaseUrl={imageBaseUrl}
                    headBranch={headBranch}
                    selectedSnapshotKey={selectedSnapshotKey ?? null}
                    onSelectSnapshot={onSelectSnapshot}
                    onOpenSnapshot={onOpenSnapshot}
                    diffMode={diffMode}
                    overlayColor={overlayColor}
                    overlayOpacity={overlayOpacity}
                    diffImageBaseUrl={diffImageBaseUrl}
                    onSetViewed={handleSetViewed}
                  />
                )}
              </RowFrame>
            </RowPositioner>
          );
        })}
      </Container>
    </ScrollContainer>
  );
});

function trackImageViewedToggled(
  organization: Organization,
  card: GroupCard,
  viewed: boolean
) {
  const diffStatus = card.type === 'pair-card' ? card.status : card.cardType;
  trackAnalytics('preprod.snapshots.details.image_viewed_toggled', {
    organization,
    diff_status: diffStatus === 'solo' ? null : diffStatus,
    viewed,
  });
}

const CardRow = memo(function CardRowImpl({
  row,
  imageBaseUrl,
  headBranch,
  selectedSnapshotKey,
  onSelectSnapshot,
  onOpenSnapshot,
  diffMode,
  overlayColor,
  overlayOpacity,
  diffImageBaseUrl,
  onSetViewed,
}: {
  diffMode: DiffMode;
  imageBaseUrl: string;
  onSetViewed: (keys: string[], isViewed: boolean) => void;
  row: Extract<ListRow, {kind: 'card'}>;
  selectedSnapshotKey: string | null;
  diffImageBaseUrl?: string;
  headBranch?: string | null;
  onOpenSnapshot?: (key: string) => void;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
  overlayOpacity?: number;
}) {
  const organization = useOrganization();
  const {card} = row;
  const snapshotKey = snapshotKeyFor(card);
  const isSelected = snapshotKey === selectedSnapshotKey;
  const copyUrl = useMemo(() => buildSnapshotLink(snapshotKey), [snapshotKey]);
  const diffStatus = card.type === 'pair-card' ? card.status : card.cardType;
  const onCopyLink = useCallback(
    () =>
      trackAnalytics('preprod.snapshots.details.image_link_copied', {
        organization,
        diff_status: diffStatus === 'solo' ? null : diffStatus,
      }),
    [organization, diffStatus]
  );
  const onCopyMetadata = useCallback(
    () =>
      trackAnalytics('preprod.snapshots.details.image_metadata_copied', {
        organization,
        diff_status: diffStatus === 'solo' ? null : diffStatus,
      }),
    [organization, diffStatus]
  );
  const {viewedKey} = card;
  const {isViewed} = row;
  const handleToggleViewed = useCallback(() => {
    if (viewedKey === null) {
      return;
    }
    onSetViewed([viewedKey], !isViewed);
    trackImageViewedToggled(organization, card, !isViewed);
  }, [viewedKey, isViewed, onSetViewed, organization, card]);
  const onToggleViewed = viewedKey === null ? undefined : handleToggleViewed;
  return card.type === 'pair-card' ? (
    <PairCard
      pair={card.pair}
      status={card.status}
      imageBaseUrl={imageBaseUrl}
      headBranch={headBranch}
      isSelected={isSelected}
      copyUrl={copyUrl}
      diffMode={diffMode}
      overlayColor={overlayColor}
      overlayOpacity={overlayOpacity}
      diffImageBaseUrl={diffImageBaseUrl}
      snapshotKey={snapshotKey}
      onSelectSnapshot={onSelectSnapshot}
      onOpenSnapshot={onOpenSnapshot}
      onCopyLink={onCopyLink}
      onCopyMetadata={onCopyMetadata}
      isViewed={isViewed}
      onToggleViewed={onToggleViewed}
    />
  ) : (
    <ImageCard
      image={card.image}
      cardType={card.cardType}
      copyData={card.copyData}
      imageBaseUrl={imageBaseUrl}
      isSelected={isSelected}
      copyUrl={copyUrl}
      snapshotKey={snapshotKey}
      onSelectSnapshot={onSelectSnapshot}
      onOpenSnapshot={onOpenSnapshot}
      onCopyLink={onCopyLink}
      onCopyMetadata={onCopyMetadata}
      isViewed={isViewed}
      onToggleViewed={onToggleViewed}
    />
  );
});

function GroupHeaderRow({
  row,
  onSetViewed,
}: {
  onSetViewed: (keys: string[], isViewed: boolean) => void;
  row: Extract<ListRow, {kind: 'header'}>;
}) {
  const organization = useOrganization();
  const handleToggleViewed = () => {
    const viewed = row.isViewed !== true;
    onSetViewed(row.viewedKeys, viewed);
    trackAnalytics('preprod.snapshots.details.group_viewed_toggled', {
      organization,
      viewed,
      image_count: row.viewedKeys.length,
    });
  };
  return (
    <SnapshotGroupHeader
      name={row.groupName}
      isViewed={row.isViewed}
      onToggleViewed={row.viewedKeys.length > 0 ? handleToggleViewed : undefined}
    />
  );
}

const ScrollContainer = styled(Container)`
  overflow-anchor: none;
  scroll-padding-top: ${p => p.theme.space.md};
  scroll-padding-bottom: ${p => p.theme.space.md};

  &:focus-visible {
    outline: none;
  }
`;

const StickyGroupHeader = styled('div')`
  position: sticky;
  top: -${p => p.theme.space.xl};
  z-index: 1;
  height: 0;
  pointer-events: none;

  label {
    pointer-events: auto;
  }

  > * {
    border-left: 1px solid ${p => p.theme.tokens.border.primary};
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
    transform: translateY(var(--sticky-header-translate-y, 0px));
  }

  &[data-detached-frame] > * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    border-top-left-radius: ${p => p.theme.radius.md};
    border-top-right-radius: ${p => p.theme.radius.md};
  }

  &[data-bottom-frame] > * {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
    border-bottom: 0;
  }
`;

const RowPositioner = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  contain: layout paint;

  &[data-last-in-group] {
    padding-bottom: ${p => p.theme.space.xl};
  }
`;
