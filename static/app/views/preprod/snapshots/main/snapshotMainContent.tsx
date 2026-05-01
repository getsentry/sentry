import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProgressBar} from 'sentry/components/progressBar';
import {
  IconArrow,
  IconExpand,
  IconInput,
  IconList,
  IconPause,
  IconStack,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DiffStatus, getImageName} from 'sentry/views/preprod/types/snapshotTypes';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import {
  DiffImageDisplay,
  type DiffMode,
  TRANSPARENT_COLOR,
} from './imageDisplay/diffImageDisplay';
import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';
import {CardHeader, DarkAware} from './snapshotCards';
import {SnapshotCardFrame, SnapshotVariantFrame} from './snapshotFrames';
import {
  buildSnapshotLink,
  isItemUngrouped,
  SnapshotListView,
  type SnapshotListViewHandle,
} from './snapshotListView';

type ViewMode = 'single' | 'list';
type SortBy = 'diff' | 'alpha';

export interface NavButtonRefs {
  next: React.RefObject<HTMLButtonElement | null>;
  prev: React.RefObject<HTMLButtonElement | null>;
}

interface SnapshotMainContentProps {
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  comparisonType: 'diff' | 'solo' | undefined;
  diffImageBaseUrl: string;
  diffMode: DiffMode;
  hasDiffComparison: boolean;
  imageBaseUrl: string;
  isSoloView: boolean;
  listItems: SidebarItem[];
  navButtonRefs: NavButtonRefs;
  onDiffModeChange: (mode: DiffMode) => void;
  onNavigateSingleView: (direction: 'prev' | 'next') => void;
  onOverlayColorChange: (color: string) => void;
  onToggleSoloView: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  overlayColor: string;
  selectedItem: SidebarItem | null;
  variantIndex: number;
  viewMode: ViewMode;
  headBranch?: string | null;
  listViewRef?: React.RefObject<SnapshotListViewHandle | null>;
  onSelectSnapshot?: (key: string | null) => void;
  onSortByChange?: (sort: SortBy) => void;
  onVisibleGroupChange?: (name: string | null) => void;
  selectedSnapshotKey?: string | null;
  sortBy?: SortBy;
}

export function SnapshotMainContent({
  selectedItem,
  variantIndex,
  imageBaseUrl,
  diffImageBaseUrl,
  overlayColor,
  onOverlayColorChange,
  diffMode,
  onDiffModeChange,
  viewMode,
  onViewModeChange,
  listItems,
  hasDiffComparison,
  isSoloView,
  onToggleSoloView,
  comparisonType,
  headBranch,
  listViewRef,
  selectedSnapshotKey,
  onSelectSnapshot,
  sortBy = 'diff',
  onSortByChange,
  onVisibleGroupChange,
  onNavigateSingleView,
  canNavigatePrev,
  canNavigateNext,
  navButtonRefs,
}: SnapshotMainContentProps) {
  const [isDark, setIsDark] = useState(false);
  const toggleDark = useCallback(() => setIsDark(v => !v), []);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const {cardOffsets, totalCards} = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const item of listItems) {
      offsets.push(total);
      const count =
        item.type === 'changed' || item.type === 'renamed'
          ? item.pairs.length
          : item.images.length;
      total += count;
    }
    return {cardOffsets: offsets, totalCards: total};
  }, [listItems]);

  const handleListScrollProgress = useCallback(
    (progress: number, firstVisibleCardIndex: number) => {
      setScrollProgress(progress);
      setCurrentCardIndex(firstVisibleCardIndex);
    },
    []
  );

  const singleViewIndex = useMemo(() => {
    if (!selectedItem) {
      return 0;
    }
    const idx = listItems.indexOf(selectedItem);
    return idx === -1 ? 0 : idx;
  }, [selectedItem, listItems]);

  useEffect(() => {
    if (viewMode !== 'single') {
      return;
    }
    const cardIndex = (cardOffsets[singleViewIndex] ?? 0) + variantIndex;
    setCurrentCardIndex(cardIndex);
    setScrollProgress(totalCards <= 1 ? 100 : (cardIndex / (totalCards - 1)) * 100);
  }, [viewMode, singleViewIndex, variantIndex, totalCards, cardOffsets]);

  const handleOpenSnapshot = useCallback(
    (key: string) => {
      onSelectSnapshot?.(key);
      onViewModeChange('single');
    },
    [onSelectSnapshot, onViewModeChange]
  );

  const toggle = (
    <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
  );
  const progressIndicator = totalCards > 0 && (
    <ProgressPill>
      <ToolbarProgressBar value={scrollProgress} />
      <ProgressCounter size="xs" variant="muted">
        {currentCardIndex + 1}/{totalCards}
      </ProgressCounter>
    </ProgressPill>
  );
  const hasChangedInList = listItems.some(i => i.type === 'changed');
  const sortDropdown =
    onSortByChange && comparisonType !== 'solo' && hasChangedInList ? (
      <SortDropdown value={sortBy} onChange={onSortByChange} />
    ) : null;
  const listDiffControls =
    viewMode === 'list' && hasChangedInList ? (
      <Flex align="center" gap="sm">
        {diffMode === 'split' && (
          <ColorPickerButton color={overlayColor} onChange={onOverlayColorChange} />
        )}
        <DiffModeToggle diffMode={diffMode} onDiffModeChange={onDiffModeChange} />
      </Flex>
    ) : null;
  let soloDiffToggle: React.ReactNode = null;
  if (hasDiffComparison) {
    soloDiffToggle = (
      <SoloDiffToggle isSoloView={isSoloView} onToggleSoloView={onToggleSoloView} />
    );
  } else if (comparisonType === 'solo') {
    soloDiffToggle = <Tag variant="promotion">{t('Base')}</Tag>;
  }

  if (viewMode === 'list') {
    return (
      <Flex
        direction="column"
        gap="0"
        padding="0"
        height="100%"
        width="100%"
        background="secondary"
      >
        <Flex align="center" justify="between" gap="md" padding="md xl md 0">
          <Flex align="center" gap="md" onClick={e => e.stopPropagation()}>
            {toggle}
            {sortDropdown}
            {progressIndicator}
          </Flex>
          <Flex align="center" gap="md" onClick={e => e.stopPropagation()}>
            {listDiffControls}
            {soloDiffToggle}
          </Flex>
        </Flex>
        <Separator orientation="horizontal" />
        <SnapshotListView
          ref={listViewRef}
          items={listItems}
          imageBaseUrl={imageBaseUrl}
          headBranch={headBranch}
          selectedSnapshotKey={selectedSnapshotKey}
          onSelectSnapshot={onSelectSnapshot}
          onOpenSnapshot={handleOpenSnapshot}
          onScrollProgress={handleListScrollProgress}
          diffMode={diffMode}
          overlayColor={overlayColor}
          diffImageBaseUrl={diffImageBaseUrl}
          onVisibleGroupChange={onVisibleGroupChange}
        />
      </Flex>
    );
  }

  if (!selectedItem) {
    return (
      <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
        <Flex align="center" justify="between" gap="md" padding="md xl md 0">
          <Flex align="center" gap="md">
            {toggle}
            {sortDropdown}
            {progressIndicator}
          </Flex>
          {soloDiffToggle}
        </Flex>
        <Separator orientation="horizontal" />
        <Flex align="center" justify="center" padding="3xl" width="100%" flex="1">
          <Text variant="muted">{t('Select an image from the sidebar.')}</Text>
        </Flex>
      </Flex>
    );
  }

  const groupName = isItemUngrouped(selectedItem) ? null : selectedItem.name;

  if (selectedItem.type === 'changed') {
    const currentPair = selectedItem.pairs[variantIndex];
    if (!currentPair) {
      return null;
    }
    const image = currentPair.head_image;
    return (
      <SingleViewLayout
        isDark={isDark}
        onToggleDark={toggleDark}
        groupName={groupName}
        toggle={toggle}
        soloDiffToggle={soloDiffToggle}
        sortDropdown={sortDropdown}
        progressIndicator={progressIndicator}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
        onNavigateSingleView={onNavigateSingleView}
        navButtonRefs={navButtonRefs}
        headerProps={{
          displayName: image.display_name,
          fileName: image.image_file_name,
          status: DiffStatus.CHANGED,
          diffPercent: currentPair.diff,
          copyData: currentPair,
          copyUrl: buildSnapshotLink(image.image_file_name),
        }}
        rightControls={
          <Fragment>
            {diffMode === 'split' && (
              <ColorPickerButton color={overlayColor} onChange={onOverlayColorChange} />
            )}
            <DiffModeToggle diffMode={diffMode} onDiffModeChange={onDiffModeChange} />
          </Fragment>
        }
        body={
          <DiffImageDisplay
            pair={currentPair}
            imageBaseUrl={imageBaseUrl}
            diffImageBaseUrl={diffImageBaseUrl}
            overlayColor={overlayColor}
            diffMode={diffMode}
            headLabel={headBranch ?? t('Head')}
          />
        }
      />
    );
  }

  if (selectedItem.type === 'renamed') {
    const currentPair = selectedItem.pairs[variantIndex];
    if (!currentPair) {
      return null;
    }
    const image = currentPair.head_image;
    const imageUrl = `${imageBaseUrl}${image.key}/`;
    return (
      <SingleViewLayout
        isDark={isDark}
        onToggleDark={toggleDark}
        groupName={groupName}
        toggle={toggle}
        soloDiffToggle={soloDiffToggle}
        sortDropdown={sortDropdown}
        progressIndicator={progressIndicator}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
        onNavigateSingleView={onNavigateSingleView}
        navButtonRefs={navButtonRefs}
        headerProps={{
          displayName: image.display_name,
          fileName: image.image_file_name,
          status: DiffStatus.RENAMED,
          copyData: currentPair,
          copyUrl: buildSnapshotLink(image.image_file_name),
        }}
        body={<SingleImageDisplay imageUrl={imageUrl} alt={getImageName(image)} />}
      />
    );
  }

  const currentImage = selectedItem.images[variantIndex];
  if (!currentImage) {
    return null;
  }
  const imageUrl = `${imageBaseUrl}${currentImage.key}/`;
  let status: DiffStatus | null;
  if (selectedItem.type === 'solo') {
    status = null;
  } else if (selectedItem.type === 'added') {
    status = DiffStatus.ADDED;
  } else if (selectedItem.type === 'removed') {
    status = DiffStatus.REMOVED;
  } else {
    status = DiffStatus.UNCHANGED;
  }

  return (
    <SingleViewLayout
      isDark={isDark}
      onToggleDark={toggleDark}
      groupName={groupName}
      toggle={toggle}
      soloDiffToggle={soloDiffToggle}
      sortDropdown={sortDropdown}
      progressIndicator={progressIndicator}
      canNavigatePrev={canNavigatePrev}
      canNavigateNext={canNavigateNext}
      onNavigateSingleView={onNavigateSingleView}
      navButtonRefs={navButtonRefs}
      headerProps={{
        displayName: currentImage.display_name,
        fileName: currentImage.image_file_name,
        status,
        copyData: currentImage,
        copyUrl: buildSnapshotLink(currentImage.image_file_name),
      }}
      body={<SingleImageDisplay imageUrl={imageUrl} alt={getImageName(currentImage)} />}
    />
  );
}

function SingleViewLayout({
  isDark,
  onToggleDark,
  groupName,
  toggle,
  soloDiffToggle,
  sortDropdown,
  progressIndicator,
  canNavigatePrev,
  canNavigateNext,
  onNavigateSingleView,
  navButtonRefs,
  headerProps,
  body,
  rightControls,
}: {
  body: React.ReactNode;
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  groupName: string | null;
  headerProps: Omit<React.ComponentProps<typeof CardHeader>, 'isDark' | 'onToggleDark'>;
  isDark: boolean;
  navButtonRefs: NavButtonRefs;
  onNavigateSingleView: (direction: 'prev' | 'next') => void;
  onToggleDark: () => void;
  progressIndicator: React.ReactNode;
  soloDiffToggle: React.ReactNode;
  sortDropdown: React.ReactNode;
  toggle: React.ReactNode;
  rightControls?: React.ReactNode;
}) {
  const wheelCooldownRef = useRef(false);
  const pressTimeoutRef = useRef<number | undefined>(undefined);
  const cooldownTimeoutRef = useRef<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const navStateRef = useRef({onNavigateSingleView, canNavigateNext, canNavigatePrev});
  navStateRef.current = {onNavigateSingleView, canNavigateNext, canNavigatePrev};

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) {
        return;
      }
      e.preventDefault();
      if (wheelCooldownRef.current) {
        return;
      }
      const {
        onNavigateSingleView: navigate,
        canNavigateNext: canNext,
        canNavigatePrev: canPrev,
      } = navStateRef.current;
      const isNext = e.deltaY > 0;
      if (isNext ? !canNext : !canPrev) {
        return;
      }
      wheelCooldownRef.current = true;
      navigate(isNext ? 'next' : 'prev');

      const btn = isNext ? navButtonRefs.next.current : navButtonRefs.prev.current;
      const otherBtn = isNext ? navButtonRefs.prev.current : navButtonRefs.next.current;
      if (btn) {
        clearTimeout(pressTimeoutRef.current);
        otherBtn?.removeAttribute('aria-pressed');
        btn.setAttribute('aria-pressed', 'true');
        pressTimeoutRef.current = window.setTimeout(
          () => btn.removeAttribute('aria-pressed'),
          150
        );
      }

      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = window.setTimeout(() => {
        wheelCooldownRef.current = false;
      }, 120);
    };
    el.addEventListener('wheel', handler, {passive: false});
    return () => {
      el.removeEventListener('wheel', handler);
      clearTimeout(pressTimeoutRef.current);
      clearTimeout(cooldownTimeoutRef.current);
    };
  }, [navButtonRefs]);

  const card = (
    <SnapshotVariantFrame fillHeight>
      <CardHeader
        {...headerProps}
        isDark={isDark}
        onToggleDark={onToggleDark}
        showBottomBorder={false}
      />
      <Flex direction="column" flex="1" minHeight="0">
        {body}
      </Flex>
    </SnapshotVariantFrame>
  );
  return (
    <Flex
      direction="column"
      gap="0"
      padding="0"
      height="100%"
      width="100%"
      background="secondary"
    >
      <Flex
        align="center"
        justify="between"
        gap="md"
        padding="md xl md 0"
        onClick={e => e.stopPropagation()}
      >
        <Flex align="center" gap="md">
          {toggle}
          {sortDropdown}
          {progressIndicator}
        </Flex>
        <Flex align="center" gap="md">
          {rightControls}
          {soloDiffToggle}
        </Flex>
      </Flex>
      <Separator orientation="horizontal" />
      <SingleViewScroll ref={scrollRef}>
        <Flex direction="row" gap="xl" flex="1" minHeight="0" align="stretch">
          <Flex direction="column" flex="1" minWidth="0">
            <DarkAware isDark={isDark}>
              <SnapshotCardFrame groupName={groupName} fillHeight>
                {card}
              </SnapshotCardFrame>
            </DarkAware>
          </Flex>
          <Container flexShrink={0} onClick={e => e.stopPropagation()}>
            <NavGutter>
              <Tooltip title={t('Previous (↑)')} skipWrapper>
                <Button
                  ref={navButtonRefs.prev}
                  size="sm"
                  icon={<IconArrow direction="up" />}
                  aria-label={t('Previous snapshot')}
                  disabled={!canNavigatePrev}
                  onClick={() => onNavigateSingleView('prev')}
                />
              </Tooltip>
              <Tooltip title={t('Next (↓)')} skipWrapper>
                <Button
                  ref={navButtonRefs.next}
                  size="sm"
                  icon={<IconArrow direction="down" />}
                  aria-label={t('Next snapshot')}
                  disabled={!canNavigateNext}
                  onClick={() => onNavigateSingleView('next')}
                />
              </Tooltip>
            </NavGutter>
          </Container>
        </Flex>
      </SingleViewScroll>
    </Flex>
  );
}

function SoloDiffToggle({
  isSoloView,
  onToggleSoloView,
}: {
  isSoloView: boolean;
  onToggleSoloView: () => void;
}) {
  return (
    <SegmentedControl
      size="xs"
      value={isSoloView ? 'head' : 'diff'}
      aria-label={t('Comparison view')}
      onChange={value => {
        if ((value === 'head') !== isSoloView) {
          onToggleSoloView();
        }
      }}
    >
      <SegmentedControl.Item key="diff" tooltip={t('Compare with base')}>
        {t('Diff')}
      </SegmentedControl.Item>
      <SegmentedControl.Item key="head" tooltip={t('Head only')}>
        {t('Head')}
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  onViewModeChange: (mode: ViewMode) => void;
  viewMode: ViewMode;
}) {
  return (
    <SegmentedControl
      size="xs"
      value={viewMode}
      onChange={onViewModeChange}
      aria-label={t('View mode')}
    >
      <SegmentedControl.Item
        key="list"
        icon={<IconList />}
        aria-label={t('List view')}
        tooltip={t('List view (←)')}
      />
      <SegmentedControl.Item
        key="single"
        icon={<IconExpand />}
        aria-label={t('Single image view')}
        tooltip={t('Single image view (→)')}
      />
    </SegmentedControl>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  onChange: (sort: SortBy) => void;
  value: SortBy;
}) {
  return (
    <CompactSelect
      size="xs"
      value={value}
      onChange={opt => onChange(opt.value)}
      options={[
        {value: 'diff' as const, label: t('Diff %')},
        {value: 'alpha' as const, label: t('A - Z')},
      ]}
    />
  );
}

function ColorPickerButton({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const overlayColors = [TRANSPARENT_COLOR, ...theme.chart.getColorPalette(10)];

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  return (
    <ColorPickerWrapper ref={pickerRef}>
      <Tooltip title={t('Overlay color')} skipWrapper>
        <ColorTrigger
          color={color}
          aria-label={t('Pick overlay color')}
          onClick={() => setIsOpen(v => !v)}
        />
      </Tooltip>
      {isOpen && (
        <ColorPickerDropdown>
          <Flex gap="xs">
            {overlayColors.map(c => (
              <ColorSwatch
                key={c}
                color={c}
                selected={color === c}
                onClick={() => {
                  onChange(c);
                  setIsOpen(false);
                }}
                aria-label={t('Overlay color %s', c)}
              />
            ))}
          </Flex>
        </ColorPickerDropdown>
      )}
    </ColorPickerWrapper>
  );
}

function DiffModeToggle({
  diffMode,
  onDiffModeChange,
}: {
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
}) {
  return (
    <SegmentedControl size="xs" value={diffMode} onChange={onDiffModeChange}>
      <SegmentedControl.Item
        key="split"
        icon={<IconPause />}
        aria-label={t('Split')}
        tooltip={t('Split')}
      />
      <SegmentedControl.Item
        key="wipe"
        icon={<IconInput />}
        aria-label={t('Wipe')}
        tooltip={t('Wipe')}
      />
      <SegmentedControl.Item
        key="onion"
        icon={<IconStack />}
        aria-label={t('Onion')}
        tooltip={t('Onion')}
      />
    </SegmentedControl>
  );
}

const SingleViewScroll = styled('div')`
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  overflow: auto;
  padding: ${p => p.theme.space.xl};
  padding-left: 0;
  display: flex;
  flex-direction: column;
`;

const NavGutter = styled('div')`
  position: sticky;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  flex-shrink: 0;

  button[aria-pressed='true'] {
    &::after {
      transform: translateY(0px);
    }
    > span:last-child {
      transform: translateY(0px);
    }
  }
`;

const ColorPickerWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const ColorPickerDropdown = styled('div')`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.sm};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.high};
  z-index: ${p => p.theme.zIndex.dropdown};
`;

const ColorTrigger = styled('button')<{color: string}>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid ${p => p.theme.tokens.border.primary};
  background-color: ${p => (p.color === TRANSPARENT_COLOR ? 'transparent' : p.color)};
  padding: 0;
  ${p =>
    p.color === TRANSPARENT_COLOR &&
    `background-image: linear-gradient(
      to top right,
      transparent calc(50% - 2px),
      ${p.theme.tokens.content.danger} calc(50% - 1px),
      ${p.theme.tokens.content.danger} calc(50% + 1px),
      transparent calc(50% + 2px)
    );`}

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;

const ProgressPill = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const ProgressCounter = styled(Text)`
  white-space: nowrap;
  font-family: ${p => p.theme.font.family.mono};
`;

const ToolbarProgressBar = styled(ProgressBar)`
  width: 50px;
`;

const ColorSwatch = styled('button')<{color: string; selected: boolean}>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid
    ${p => (p.selected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  background-color: ${p => (p.color === TRANSPARENT_COLOR ? 'transparent' : p.color)};
  padding: 0;
  outline: ${p => (p.selected ? `2px solid ${p.theme.tokens.focus.default}` : 'none')};
  outline-offset: 1px;
  ${p =>
    p.color === TRANSPARENT_COLOR &&
    `background-image: linear-gradient(
      to top right,
      transparent calc(50% - 1.5px),
      ${p.theme.tokens.content.danger} calc(50% - 0.5px),
      ${p.theme.tokens.content.danger} calc(50% + 0.5px),
      transparent calc(50% + 1.5px)
    );`}
`;
