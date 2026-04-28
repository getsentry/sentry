import {memo, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {
  SidebarItem,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './imageDisplay/diffImageDisplay';
import {ImageCard, PairCard} from './snapshotCards';
import {MAX_IMAGE_HEIGHT} from './snapshotDiffBodies';

interface SnapshotListViewProps {
  imageBaseUrl: string;
  items: SidebarItem[];
  diffImageBaseUrl?: string;
  diffMode?: DiffMode;
  headBranch?: string | null;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
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
      cardType: 'changed' | 'renamed';
      estimatedHeight: number;
      id: string;
      pair: SnapshotDiffPair;
      type: 'pair-card';
    }
  | {
      cardType: 'added' | 'removed' | 'unchanged' | 'solo';
      estimatedHeight: number;
      id: string;
      image: SnapshotImage;
      type: 'image-card';
    };

interface GroupRow {
  cards: GroupCard[];
  estimatedHeight: number;
  id: string;
  isUngrouped: boolean;
  name: string;
}

const HEADER_HEIGHT = 44;
const CARD_CHROME_HEIGHT = 120;
const CARD_GAP = 16;
const GROUP_PADDING = 32;
const ROW_PADDING_BOTTOM = 16;
const LIST_CONTENT_WIDTH_ASSUMPTION = 900;

function estimateCardHeight(image: SnapshotImage, splitColumns: boolean) {
  const columnWidth = splitColumns
    ? LIST_CONTENT_WIDTH_ASSUMPTION / 2
    : LIST_CONTENT_WIDTH_ASSUMPTION;
  // The <img> uses width: auto + max-width: 100%, so it never scales up past
  // its natural size. Mirror that here: only scale down when natural width
  // exceeds the column.
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
  if (item.type === 'changed' || item.type === 'renamed') {
    return !item.pairs[0]?.head_image.group;
  }
  return !item.images[0]?.group;
}

function buildGroups(items: SidebarItem[]): GroupRow[] {
  const groups: GroupRow[] = [];
  for (const item of items) {
    const cards: GroupCard[] = [];
    if (item.type === 'changed' || item.type === 'renamed') {
      for (const pair of item.pairs) {
        cards.push({
          type: 'pair-card',
          id: `c:${item.key}:${pair.head_image.key}`,
          pair,
          cardType: item.type,
          estimatedHeight: Math.max(
            estimateCardHeight(pair.head_image, true),
            estimateCardHeight(pair.base_image, true)
          ),
        });
      }
    } else {
      for (const image of item.images) {
        cards.push({
          type: 'image-card',
          id: `c:${item.key}:${image.key}`,
          image,
          cardType: item.type,
          estimatedHeight: estimateCardHeight(image, false),
        });
      }
    }
    const cardsHeight = cards.reduce(
      (sum, c, i) => sum + c.estimatedHeight + (i > 0 ? CARD_GAP : 0),
      0
    );
    const ungrouped = isItemUngrouped(item);
    groups.push({
      id: `g:${item.key}`,
      name: item.name,
      cards,
      isUngrouped: ungrouped,
      estimatedHeight:
        (ungrouped ? cardsHeight : HEADER_HEIGHT + cardsHeight + GROUP_PADDING) +
        ROW_PADDING_BOTTOM,
    });
  }
  return groups;
}

export function SnapshotListView({
  items,
  imageBaseUrl,
  headBranch,
  selectedSnapshotKey,
  onSelectSnapshot,
  diffMode = 'split',
  overlayColor,
  diffImageBaseUrl,
}: SnapshotListViewProps) {
  const groups = useMemo(() => buildGroups(items), [items]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: i => groups[i]!.estimatedHeight,
    getItemKey: i => groups[i]!.id,
    overscan: 2,
    // Breathing margin between the target card and the chrome when scrollToIndex aligns to either edge
    scrollPaddingEnd: 8,
  });

  // Flat (snapshotKey -> groupIdx / position) index for keyboard nav and scroll; O(1) lookups
  const flatIndex = useMemo(() => {
    const order: string[] = [];
    const groupIdxByKey = new Map<string, number>();
    const positionByKey = new Map<string, number>();
    for (let gi = 0; gi < groups.length; gi++) {
      for (const card of groups[gi]!.cards) {
        const key = snapshotKeyFor(card);
        positionByKey.set(key, order.length);
        order.push(key);
        groupIdxByKey.set(key, gi);
      }
    }
    return {order, groupIdxByKey, positionByKey};
  }, [groups]);

  // Auto-scroll once on mount if URL has selectedSnapshot; card clicks never trigger scroll
  const initialSnapshotKey = useRef(selectedSnapshotKey ?? null).current;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || !initialSnapshotKey || groups.length === 0) {
      return;
    }
    const targetIdx = flatIndex.groupIdxByKey.get(initialSnapshotKey);
    if (targetIdx !== undefined) {
      virtualizer.scrollToIndex(targetIdx, {align: 'start'});
      didInitialScroll.current = true;
    }
  }, [groups, initialSnapshotKey, flatIndex, virtualizer]);

  const keyNavRef = useRef({
    flatIndex,
    selectedSnapshotKey,
    onSelectSnapshot,
    virtualizer,
  });
  keyNavRef.current = {flatIndex, selectedSnapshotKey, onSelectSnapshot, virtualizer};
  useEffect(() => {
    function scrollCardIntoView(key: string, block: ScrollLogicalPosition) {
      const cardEl = scrollRef.current?.querySelector<HTMLElement>(
        `[data-snapshot-key="${CSS.escape(key)}"]`
      );
      if (!cardEl) {
        return false;
      }
      cardEl.scrollIntoView({block});
      return true;
    }

    function revealCard(key: string, block: ScrollLogicalPosition) {
      if (scrollCardIntoView(key, block)) {
        return;
      }
      const groupIdx = keyNavRef.current.flatIndex.groupIdxByKey.get(key);
      if (groupIdx === undefined) {
        return;
      }
      keyNavRef.current.virtualizer.scrollToIndex(groupIdx, {
        align: block === 'start' ? 'start' : 'auto',
      });
      requestAnimationFrame(() => scrollCardIntoView(key, block));
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== ' ') {
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      const {
        flatIndex: idx,
        selectedSnapshotKey: currentKey,
        onSelectSnapshot: onSelect,
      } = keyNavRef.current;
      if (idx.order.length === 0) {
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

      const lastPos = idx.order.length - 1;
      const currentPos = currentKey ? (idx.positionByKey.get(currentKey) ?? -1) : -1;
      const isDown = e.key === 'ArrowDown';
      let nextPos: number;
      if (currentPos === -1) {
        nextPos = isDown ? 0 : lastPos;
      } else {
        nextPos = Math.max(0, Math.min(lastPos, currentPos + (isDown ? 1 : -1)));
      }
      if (nextPos === currentPos) {
        return;
      }
      e.preventDefault();
      const nextKey = idx.order[nextPos]!;
      onSelect(nextKey);
      revealCard(nextKey, 'nearest');
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (items.length === 0) {
    return (
      <Flex align="center" justify="center" padding="3xl" width="100%">
        <Text variant="muted">{t('No snapshots found.')}</Text>
      </Flex>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <ScrollContainer ref={scrollRef}>
      <Container position="relative" width="100%" style={{height: totalSize}}>
        {virtualItems.map(vi => {
          const group = groups[vi.index]!;
          return (
            <RowPositioner
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{transform: `translateY(${vi.start}px)`}}
            >
              <GroupContainer
                group={group}
                imageBaseUrl={imageBaseUrl}
                headBranch={headBranch}
                selectedSnapshotKey={selectedSnapshotKey ?? null}
                onSelectSnapshot={onSelectSnapshot}
                diffMode={diffMode}
                overlayColor={overlayColor}
                diffImageBaseUrl={diffImageBaseUrl}
              />
            </RowPositioner>
          );
        })}
      </Container>
    </ScrollContainer>
  );
}

const GroupContainer = memo(function GroupContainer({
  group,
  imageBaseUrl,
  headBranch,
  selectedSnapshotKey,
  onSelectSnapshot,
  diffMode,
  overlayColor,
  diffImageBaseUrl,
}: {
  diffMode: DiffMode;
  group: GroupRow;
  imageBaseUrl: string;
  selectedSnapshotKey: string | null;
  diffImageBaseUrl?: string;
  headBranch?: string | null;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
}) {
  const cards = group.cards.map(card => {
    const snapshotKey = snapshotKeyFor(card);
    const isSelected = snapshotKey === selectedSnapshotKey;
    const copyUrl = buildSnapshotLink(snapshotKey);
    return card.type === 'pair-card' ? (
      <PairCard
        key={card.id}
        pair={card.pair}
        cardType={card.cardType}
        imageBaseUrl={imageBaseUrl}
        headBranch={headBranch}
        isSelected={isSelected}
        copyUrl={copyUrl}
        diffMode={diffMode}
        overlayColor={overlayColor}
        diffImageBaseUrl={diffImageBaseUrl}
        snapshotKey={snapshotKey}
        onSelectSnapshot={onSelectSnapshot}
      />
    ) : (
      <ImageCard
        key={card.id}
        image={card.image}
        cardType={card.cardType}
        imageBaseUrl={imageBaseUrl}
        headBranch={headBranch}
        isSelected={isSelected}
        copyUrl={copyUrl}
        snapshotKey={snapshotKey}
        onSelectSnapshot={onSelectSnapshot}
      />
    );
  });

  if (group.isUngrouped) {
    return <Stack gap="md">{cards}</Stack>;
  }

  return (
    <Stack background="primary" border="primary" radius="md" padding="lg" gap="md">
      <GroupHeader name={group.name} />
      <Stack gap="md">{cards}</Stack>
    </Stack>
  );
});

export const GroupHeader = memo(function GroupHeader({name}: {name: string}) {
  return (
    <Container padding="0 xs">
      <Heading as="h3" size="md">
        {name}
      </Heading>
    </Container>
  );
});

const ScrollContainer = styled('div')`
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl} ${p => p.theme.space.xl} 0;
  background: ${p => p.theme.tokens.background.secondary};
  contain: layout;
  overscroll-behavior: contain;
  scroll-padding-top: ${p => p.theme.space.md};
  scroll-padding-bottom: ${p => p.theme.space.md};
`;

const RowPositioner = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding-bottom: ${p => p.theme.space.xl};
  contain: layout paint;
`;
