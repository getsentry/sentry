import {Fragment, memo, useEffect, useMemo, useRef, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {IconInfo, IconLightning, IconLink, IconMoon} from 'sentry/icons';
import {t} from 'sentry/locale';
// eslint-disable-next-line no-restricted-imports
import {darkTheme} from 'sentry/utils/theme/theme';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import type {
  SidebarItem,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';
import {DiffStatus, getImageName} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './imageDisplay/diffImageDisplay';
import {useSyncedD3Zoom} from './imageDisplay/useD3Zoom';
import {ZoomControls, zoomTransformStyle} from './imageDisplay/zoomControls';

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
  const params = new URLSearchParams();
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
const MAX_IMAGE_HEIGHT = 480;
const LIST_CONTENT_WIDTH_ASSUMPTION = 900;

function estimateCardHeight(image: SnapshotImage, splitColumns: boolean) {
  const columnWidth = splitColumns
    ? LIST_CONTENT_WIDTH_ASSUMPTION / 2
    : LIST_CONTENT_WIDTH_ASSUMPTION;
  const aspectHeight =
    image.width > 0 ? (image.height / image.width) * columnWidth : MAX_IMAGE_HEIGHT;
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
          estimatedHeight: estimateCardHeight(pair.head_image, true),
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
      estimatedHeight: ungrouped
        ? cardsHeight
        : HEADER_HEIGHT + cardsHeight + GROUP_PADDING,
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
    // Leaves a small breathing margin between the target card and the
    // chrome when scrollToIndex aligns to either edge.
    scrollPaddingEnd: 8,
  });

  // Flat (snapshotKey -> groupIdx / position) index for keyboard navigation and
  // scroll. Rebuilt only when groups change; lookups are O(1).
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

  // Only auto-scroll once, on initial mount, and only if the URL already
  // contains a selectedSnapshot. Subsequent scroll updates come from keyboard
  // navigation below — card clicks never trigger scroll.
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

  // Arrow-key navigation across all cards in the list (flat, across groups).
  // Ref so the listener registers once and reads latest state.
  const keyNavRef = useRef({flatIndex, selectedSnapshotKey, onSelectSnapshot});
  keyNavRef.current = {flatIndex, selectedSnapshotKey, onSelectSnapshot};
  useEffect(() => {
    // Scroll the individual card (not its group) into view. Group-level
    // scrolling snaps past the target when moving between cards inside a
    // multi-card group.
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
      // Card not rendered (outside overscan) — scroll to its group to mount
      // it, then align on the next frame.
      const groupIdx = keyNavRef.current.flatIndex.groupIdxByKey.get(key);
      if (groupIdx === undefined) {
        return;
      }
      virtualizer.scrollToIndex(groupIdx, {align: block === 'start' ? 'start' : 'auto'});
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
      e.preventDefault();

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
      const nextKey = idx.order[nextPos]!;
      onSelect(nextKey);
      revealCard(nextKey, 'nearest');
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [virtualizer]);

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
      <TotalSpacer style={{height: totalSize}}>
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
      </TotalSpacer>
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
    return <GroupCards>{cards}</GroupCards>;
  }

  return (
    <GroupContainerRoot>
      <GroupHeader name={group.name} />
      <GroupCards>{cards}</GroupCards>
    </GroupContainerRoot>
  );
});

export function DarkAware({
  isDark,
  children,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  if (!isDark) {
    return <Fragment>{children}</Fragment>;
  }
  return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}

export const GroupHeader = memo(function GroupHeader({name}: {name: string}) {
  return (
    <GroupHeaderRoot>
      <Heading as="h3" size="md">
        {name}
      </Heading>
    </GroupHeaderRoot>
  );
});

const PairCard = memo(function PairCard({
  pair,
  cardType,
  imageBaseUrl,
  headBranch,
  isSelected,
  copyUrl,
  diffMode,
  overlayColor,
  diffImageBaseUrl,
  snapshotKey,
  onSelectSnapshot,
}: {
  cardType: 'changed' | 'renamed';
  copyUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  isSelected: boolean;
  pair: SnapshotDiffPair;
  snapshotKey: string;
  diffImageBaseUrl?: string;
  headBranch?: string | null;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
}) {
  const [isDark, setIsDark] = useState(false);
  const image = pair.head_image;
  const baseUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headUrl = `${imageBaseUrl}${image.key}/`;

  // Renamed cards always show split — wipe/onion don't make sense for file renames
  const effectiveMode = cardType === 'renamed' ? ('split' as const) : diffMode;
  const handleSelect = onSelectSnapshot
    ? () => onSelectSnapshot(isSelected ? null : snapshotKey)
    : undefined;

  let body: React.ReactNode;
  if (effectiveMode === 'split') {
    body = (
      <SplitPairBody
        baseUrl={baseUrl}
        headUrl={headUrl}
        baseImage={pair.base_image}
        headImage={image}
        headLabel={headBranch ?? t('Head')}
        altPrefix={getImageName(image)}
        overlayColor={cardType === 'changed' ? overlayColor : undefined}
        diffImageKey={cardType === 'changed' ? pair.diff_image_key : null}
        diffImageBaseUrl={diffImageBaseUrl}
      />
    );
  } else if (effectiveMode === 'wipe') {
    body = (
      <WipeCardBody
        baseUrl={baseUrl}
        headUrl={headUrl}
        baseImage={pair.base_image}
        headImage={image}
      />
    );
  } else {
    body = (
      <OnionCardBody
        baseUrl={baseUrl}
        headUrl={headUrl}
        baseImage={pair.base_image}
        headImage={image}
      />
    );
  }

  return (
    <DarkAware isDark={isDark}>
      <Card isDark={isDark} isSelected={isSelected} data-snapshot-key={snapshotKey}>
        <CardHeader
          displayName={image.display_name}
          fileName={image.image_file_name}
          status={cardType === 'changed' ? DiffStatus.CHANGED : DiffStatus.RENAMED}
          diffPercent={cardType === 'changed' ? pair.diff : null}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={pair}
          copyUrl={copyUrl}
          onSelect={handleSelect}
          isSelected={isSelected}
        />
        {body}
      </Card>
    </DarkAware>
  );
});

const ImageCard = memo(function ImageCard({
  image,
  cardType,
  imageBaseUrl,
  headBranch,
  isSelected,
  copyUrl,
  snapshotKey,
  onSelectSnapshot,
}: {
  cardType: 'added' | 'removed' | 'unchanged' | 'solo';
  copyUrl: string;
  image: SnapshotImage;
  imageBaseUrl: string;
  isSelected: boolean;
  snapshotKey: string;
  headBranch?: string | null;
  onSelectSnapshot?: (key: string | null) => void;
}) {
  const [isDark, setIsDark] = useState(false);
  const imageUrl = `${imageBaseUrl}${image.key}/`;
  let status: DiffStatus | null;
  if (cardType === 'solo') {
    status = null;
  } else if (cardType === 'added') {
    status = DiffStatus.ADDED;
  } else if (cardType === 'removed') {
    status = DiffStatus.REMOVED;
  } else {
    status = DiffStatus.UNCHANGED;
  }

  const label = cardType === 'removed' ? t('Base') : (headBranch ?? t('Head'));
  const handleSelect = onSelectSnapshot
    ? () => onSelectSnapshot(isSelected ? null : snapshotKey)
    : undefined;

  return (
    <DarkAware isDark={isDark}>
      <Card isDark={isDark} isSelected={isSelected} data-snapshot-key={snapshotKey}>
        <CardHeader
          displayName={image.display_name}
          fileName={image.image_file_name}
          status={status}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={image}
          copyUrl={copyUrl}
          onSelect={handleSelect}
          isSelected={isSelected}
        />
        <ImageColumn
          label={label}
          src={imageUrl}
          alt={getImageName(image)}
          image={image}
        />
      </Card>
    </DarkAware>
  );
});

export const CardHeader = memo(function CardHeader({
  displayName,
  fileName,
  status,
  diffPercent,
  isDark,
  onToggleDark,
  copyData,
  copyUrl,
  onSelect,
  isSelected,
}: {
  copyData: unknown;
  copyUrl: string;
  fileName: string;
  isDark: boolean;
  onToggleDark: () => void;
  diffPercent?: number | null;
  displayName?: string | null;
  isSelected?: boolean;
  onSelect?: () => void;
  status?: DiffStatus | null;
}) {
  const {copy} = useCopyToClipboard();
  // Only Enter toggles selection. Space is reserved for the list-view
  // document-level handler that scrolls the current selection to top —
  // preventDefault on space suppresses the browser's default click-on-button
  // behavior that would otherwise re-trigger onSelect.
  const handleRowKeyDown = onSelect
    ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        } else if (e.key === ' ') {
          e.preventDefault();
        }
      }
    : undefined;
  return (
    <CardHeaderRow
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? isSelected : undefined}
      isInteractive={!!onSelect}
    >
      <Stack gap="xs" minWidth="0" flex="1">
        {displayName ? (
          <Fragment>
            <Text size="md" bold ellipsis>
              {displayName}
            </Text>
            <Text size="xs" variant="muted" monospace ellipsis>
              {fileName}
            </Text>
          </Fragment>
        ) : (
          <Text size="md" bold monospace ellipsis>
            {fileName}
          </Text>
        )}
      </Stack>
      <Flex align="center" gap="sm" onClick={e => e.stopPropagation()}>
        {status && <StatusBadge status={status} diffPercent={diffPercent} />}
        <IconButton
          aria-label={isDark ? t('Switch to light preview') : t('Switch to dark preview')}
          icon={isDark ? <IconLightning size="sm" /> : <IconMoon size="sm" />}
          onClick={onToggleDark}
        />
        <IconButton
          aria-label={t('Copy link to this snapshot')}
          icon={<IconLink size="sm" />}
          onClick={() =>
            copy(copyUrl, {successMessage: t('Copied link to this snapshot')})
          }
        />
        <MetadataInfoButton copyData={copyData} />
      </Flex>
    </CardHeaderRow>
  );
});

function MetadataTooltip({json}: {json: string}) {
  return (
    <MetadataRoot>
      <MetadataHint>{t('Click info icon to copy metadata')}</MetadataHint>
      <MetadataJson>{json}</MetadataJson>
    </MetadataRoot>
  );
}

function MetadataInfoButton({copyData}: {copyData: unknown}) {
  const {copy} = useCopyToClipboard();
  const json = JSON.stringify(copyData, null, 2);

  return (
    <Tooltip title={<MetadataTooltip json={json} />} maxWidth={480}>
      <InfoIconButton
        type="button"
        aria-label={t('Copy metadata as JSON')}
        onClick={() => copy(json, {successMessage: t('Copied metadata as JSON')})}
      >
        <IconInfo size="sm" />
      </InfoIconButton>
    </Tooltip>
  );
}

// >= 1% shows 1 decimal ("93.5"); < 1% shows up to 4 without trailing zeros ("0.0227").
function formatDiffPercent(diff: number): string {
  const pct = diff * 100;
  return pct >= 1 ? pct.toFixed(1) : String(parseFloat(pct.toFixed(4)));
}

const StatusBadge = memo(function StatusBadge({
  status,
  diffPercent,
}: {
  status: DiffStatus;
  diffPercent?: number | null;
}) {
  let label: string;
  switch (status) {
    case DiffStatus.CHANGED:
      label =
        diffPercent === null || diffPercent === undefined
          ? t('Modified')
          : t('Modified - %s%%', formatDiffPercent(diffPercent));
      break;
    case DiffStatus.ADDED:
      label = t('Added');
      break;
    case DiffStatus.REMOVED:
      label = t('Removed');
      break;
    case DiffStatus.RENAMED:
      label = t('Renamed');
      break;
    default:
      label = t('Unchanged');
  }

  return <StatusBadgeContainer status={status}>{label}</StatusBadgeContainer>;
});

const SplitPairBody = memo(function SplitPairBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
  headLabel,
  altPrefix,
  overlayColor,
  diffImageKey,
  diffImageBaseUrl,
}: {
  altPrefix: string;
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headLabel: string;
  headUrl: string;
  diffImageBaseUrl?: string;
  diffImageKey?: string | null;
  overlayColor?: string;
}) {
  const [zoom1, zoom2] = useSyncedD3Zoom({wheelRequiresModifier: true});
  const hasVisibleOverlay = !!overlayColor && overlayColor !== 'transparent';
  const diffMaskUrl = useDiffMaskBlobUrl(
    hasVisibleOverlay && diffImageKey && diffImageBaseUrl
      ? `${diffImageBaseUrl}${diffImageKey}/`
      : null
  );
  return (
    <SplitPairRoot>
      <SplitGrid>
        <ImageColumnRoot withLeftBorder={false}>
          <ColumnLabel>
            <Text size="xs" variant="muted" ellipsis monospace>
              {t('Base')}
            </Text>
          </ColumnLabel>
          <ZoomViewport ref={zoom1.containerRef}>
            <ZoomTransformLayer style={zoomTransformStyle(zoom1.transform)}>
              <ImageFrame>
                <ImageEl
                  src={baseUrl}
                  alt={`${altPrefix} (base)`}
                  loading="lazy"
                  decoding="async"
                  width={baseImage.width || undefined}
                  height={baseImage.height || undefined}
                />
              </ImageFrame>
            </ZoomTransformLayer>
          </ZoomViewport>
        </ImageColumnRoot>
        <ImageColumnRoot withLeftBorder>
          <ColumnLabel>
            <Text size="xs" variant="muted" ellipsis monospace>
              {headLabel}
            </Text>
          </ColumnLabel>
          <ZoomViewport ref={zoom2.containerRef}>
            <ZoomTransformLayer style={zoomTransformStyle(zoom2.transform)}>
              <ImageFrame>
                <ImageEl
                  src={headUrl}
                  alt={`${altPrefix} (head)`}
                  loading="lazy"
                  decoding="async"
                  width={headImage.width || undefined}
                  height={headImage.height || undefined}
                />
                {hasVisibleOverlay && overlayColor && diffMaskUrl && (
                  <DiffOverlay $overlayColor={overlayColor} $maskUrl={diffMaskUrl} />
                )}
              </ImageFrame>
            </ZoomTransformLayer>
          </ZoomViewport>
        </ImageColumnRoot>
      </SplitGrid>
      <FloatingZoomControls>
        <ZoomControls
          onZoomIn={zoom1.zoomIn}
          onZoomOut={zoom1.zoomOut}
          onReset={zoom1.resetZoom}
        />
      </FloatingZoomControls>
    </SplitPairRoot>
  );
});

const ImageColumn = memo(function ImageColumn({
  label,
  src,
  alt,
  image,
  withLeftBorder,
  overlayColor,
  diffImageKey,
  diffImageBaseUrl,
}: {
  alt: string;
  image: SnapshotImage;
  label: string;
  src: string;
  diffImageBaseUrl?: string;
  diffImageKey?: string | null;
  overlayColor?: string;
  withLeftBorder?: boolean;
}) {
  const hasVisibleOverlay = !!overlayColor && overlayColor !== 'transparent';
  const diffMaskUrl = useDiffMaskBlobUrl(
    hasVisibleOverlay && diffImageKey && diffImageBaseUrl
      ? `${diffImageBaseUrl}${diffImageKey}/`
      : null
  );
  return (
    <ImageColumnRoot withLeftBorder={!!withLeftBorder}>
      <ColumnLabel>
        <Text size="xs" variant="muted" ellipsis monospace>
          {label}
        </Text>
      </ColumnLabel>
      <ImageWrapper>
        <ImageFrame>
          <ImageEl
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            width={image.width || undefined}
            height={image.height || undefined}
          />
          {hasVisibleOverlay && overlayColor && diffMaskUrl && (
            <DiffOverlay $overlayColor={overlayColor} $maskUrl={diffMaskUrl} />
          )}
        </ImageFrame>
      </ImageWrapper>
    </ImageColumnRoot>
  );
});

function useDiffMaskBlobUrl(diffImageUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!diffImageUrl) {
      setBlobUrl(null);
      return undefined;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    fetch(diffImageUrl)
      .then(r =>
        r.ok ? r.blob() : Promise.reject(new Error(`diff fetch failed: ${r.status}`))
      )
      .then(blob => {
        if (cancelled) {
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      setBlobUrl(null);
    };
  }, [diffImageUrl]);
  return blobUrl;
}

const WIPE_MIN_HEIGHT = 160;

const WipeCardBody = memo(function WipeCardBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
}: {
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headUrl: string;
}) {
  const naturalHeight = Math.max(headImage.height || 0, baseImage.height || 0);
  const minHeight = naturalHeight
    ? `${Math.min(Math.max(naturalHeight, WIPE_MIN_HEIGHT), MAX_IMAGE_HEIGHT)}px`
    : `${WIPE_MIN_HEIGHT}px`;
  return (
    <WipeBodyRoot>
      <ContentSliderDiff.Body
        before={
          <Flex justify="center" align="center" width="100%" height="100%">
            <WipeImg
              src={baseUrl}
              alt={`${getImageName(baseImage)} (base)`}
              loading="lazy"
              decoding="async"
              width={baseImage.width || undefined}
              height={baseImage.height || undefined}
            />
          </Flex>
        }
        after={
          <Flex justify="center" align="center" width="100%" height="100%">
            <WipeImg
              src={headUrl}
              alt={`${getImageName(headImage)} (head)`}
              loading="lazy"
              decoding="async"
              width={headImage.width || undefined}
              height={headImage.height || undefined}
            />
          </Flex>
        }
        minHeight={minHeight}
      />
    </WipeBodyRoot>
  );
});

const OnionCardBody = memo(function OnionCardBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
}: {
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headUrl: string;
}) {
  const [opacity, setOpacity] = useState(50);
  const maxW = Math.max(baseImage.width || 0, headImage.width || 0);
  const maxH = Math.max(baseImage.height || 0, headImage.height || 0);
  // Scale the stack's max-width down so its intrinsic aspect-ratio never
  // collides with MAX_IMAGE_HEIGHT (otherwise the stack becomes wider-than-tall
  // and percentage-sized children get stretched horizontally).
  const heightScale = maxH > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT / maxH : 1;
  const displayMaxW = maxW * heightScale;
  const basePct = {
    width: maxW ? `${((baseImage.width || 0) / maxW) * 100}%` : '100%',
    height: maxH ? `${((baseImage.height || 0) / maxH) * 100}%` : '100%',
  };
  const headPct = {
    width: maxW ? `${((headImage.width || 0) / maxW) * 100}%` : '100%',
    height: maxH ? `${((headImage.height || 0) / maxH) * 100}%` : '100%',
  };
  return (
    <Flex direction="column" gap="md" padding="lg" align="center">
      <OnionStack
        style={{
          aspectRatio: maxW && maxH ? `${maxW} / ${maxH}` : undefined,
          maxWidth: displayMaxW ? `${displayMaxW}px` : undefined,
          width: '100%',
        }}
      >
        <OnionImg
          src={baseUrl}
          alt={`${getImageName(baseImage)} (base)`}
          loading="lazy"
          decoding="async"
          style={basePct}
        />
        <OnionOverlayImg
          src={headUrl}
          alt={`${getImageName(headImage)} (head)`}
          loading="lazy"
          decoding="async"
          style={{...headPct, opacity: opacity / 100}}
        />
      </OnionStack>
      <Flex align="center" gap="sm" width="100%" justify="center">
        <Text size="xs" variant="muted">
          {t('Base')}
        </Text>
        <Flex width="200px">
          <Slider
            min={0}
            max={100}
            value={opacity}
            onChange={setOpacity}
            formatOptions={{style: 'unit', unit: 'percent'}}
          />
        </Flex>
        <Text size="xs" variant="muted">
          {t('Head')}
        </Text>
      </Flex>
    </Flex>
  );
});

function IconButton({
  icon,
  'aria-label': ariaLabel,
  onClick,
}: {
  'aria-label': string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      size="xs"
      priority="transparent"
      icon={icon}
      aria-label={ariaLabel}
      onClick={onClick}
    />
  );
}

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

const TotalSpacer = styled('div')`
  position: relative;
  width: 100%;
`;

const RowPositioner = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding-bottom: ${p => p.theme.space.xl};
  contain: layout paint;
`;

export const GroupContainerRoot = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const GroupCards = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const GroupHeaderRoot = styled('div')`
  padding: 0 ${p => p.theme.space.xs};
`;

const InfoIconButton = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};
  border-radius: ${p => p.theme.radius.sm};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 1px;
  }
`;

const MetadataRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  text-align: left;
  min-width: 260px;
`;

const MetadataHint = styled('div')`
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  padding-bottom: ${p => p.theme.space.xs};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const MetadataJson = styled('pre')`
  margin: 0;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.primary};
  white-space: pre;
  overflow-x: auto;
  max-height: 480px;
`;

export const Card = styled(Container)<{isDark: boolean; isSelected: boolean}>`
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  border: 1px solid
    ${p =>
      p.isSelected
        ? p.theme.tokens.border.accent.vibrant
        : p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  ${p => p.isDark && `color-scheme: dark;`}
`;

const CardHeaderRow = styled('div')<{isInteractive?: boolean}>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  ${p =>
    p.isInteractive &&
    `
      cursor: pointer;
      user-select: none;

      &:hover {
        background: ${p.theme.tokens.background.secondary};
      }

      &:focus {
        outline: none;
      }
    `}
`;

const ImageColumnRoot = styled('div')<{withLeftBorder: boolean}>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: ${p =>
    p.withLeftBorder ? `1px solid ${p.theme.tokens.border.secondary}` : 'none'};
`;

const ColumnLabel = styled('div')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const ImageEl = styled('img')`
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: ${MAX_IMAGE_HEIGHT}px;
`;

const ImageWrapper = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.xl};
`;

const SplitPairRoot = styled('div')`
  position: relative;
`;

const SplitGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
`;

const ZoomViewport = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.xl};
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  &:active {
    cursor: grabbing;
  }
`;

const ZoomTransformLayer = styled('div')`
  transform-origin: 0 0;
  will-change: transform;
`;

const FloatingZoomControls = styled('div')`
  position: absolute;
  bottom: ${p => p.theme.space.sm};
  right: ${p => p.theme.space.sm};
  z-index: 1;
`;

const ImageFrame = styled('div')`
  position: relative;
  display: inline-block;
  max-width: 100%;
`;

const DiffOverlay = styled('span')<{$maskUrl: string; $overlayColor: string}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-color: ${p => p.$overlayColor};
  mask-image: url(${p => p.$maskUrl});
  mask-size: 100% 100%;
  mask-mode: luminance;
  -webkit-mask-image: url(${p => p.$maskUrl});
  -webkit-mask-size: 100% 100%;
`;

const WipeBodyRoot = styled('div')`
  display: flex;
  padding: ${p => p.theme.space.xl};
`;

const WipeImg = styled('img')`
  display: block;
  max-width: 100%;
  max-height: ${MAX_IMAGE_HEIGHT}px;
  height: auto;
  object-fit: contain;
`;

const OnionStack = styled('div')`
  position: relative;
`;

const OnionImg = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
`;

const OnionOverlayImg = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
`;

const StatusBadgeContainer = styled('span')<{status: DiffStatus}>`
  display: inline-flex;
  align-items: center;
  padding: 2px ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.font.size.xs};
  white-space: nowrap;
  background: ${p => {
    switch (p.status) {
      case DiffStatus.CHANGED:
        return p.theme.tokens.background.transparent.accent.muted;
      case DiffStatus.ADDED:
        return p.theme.tokens.background.transparent.success.muted;
      case DiffStatus.REMOVED:
        return p.theme.tokens.background.transparent.danger.muted;
      case DiffStatus.RENAMED:
        return p.theme.tokens.background.transparent.warning.muted;
      case DiffStatus.UNCHANGED:
      default:
        return p.theme.tokens.background.secondary;
    }
  }};
  color: ${p => {
    switch (p.status) {
      case DiffStatus.CHANGED:
        return p.theme.tokens.content.accent;
      case DiffStatus.ADDED:
        return p.theme.tokens.content.success;
      case DiffStatus.REMOVED:
        return p.theme.tokens.content.danger;
      case DiffStatus.RENAMED:
        return p.theme.tokens.content.warning;
      case DiffStatus.UNCHANGED:
      default:
        return p.theme.tokens.content.secondary;
    }
  }};
`;
