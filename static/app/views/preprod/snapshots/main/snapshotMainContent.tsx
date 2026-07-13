import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DiffStatus,
  getImageName,
  getSnapshotImageUrl,
  isPairSidebarItem,
} from 'sentry/views/preprod/types/snapshotTypes';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import {DiffImageDisplay, type DiffMode} from './imageDisplay/diffImageDisplay';
import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';
import {CardHeader, DarkAware, ErroredBanner, useCanvasTheme} from './snapshotCards';
import {SnapshotCardFrame, SnapshotVariantFrame} from './snapshotFrames';
import {
  buildSnapshotLink,
  isItemUngrouped,
  SnapshotListView,
  type SnapshotListViewHandle,
} from './snapshotListView';
import {
  ColorPickerButton,
  DiffModeToggle,
  ProgressCounter,
  ProgressPill,
  type SortBy,
  SortDropdown,
  SoloDiffToggle,
  ToolbarContainer,
  ToolbarProgressBar,
  type ViewMode,
  ViewModeToggle,
} from './snapshotsToolbar';

export interface NavButtonRefs {
  next: React.RefObject<HTMLButtonElement | null>;
  prev: React.RefObject<HTMLButtonElement | null>;
}

interface SnapshotMainContentProps {
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  comparisonType: 'diff' | 'solo' | 'waiting_for_base' | undefined;
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
  onOverlayOpacityChange: (opacity: number) => void;
  onToggleSoloView: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  overlayColor: string;
  overlayOpacity: number;
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
  overlayOpacity,
  onOverlayOpacityChange,
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
  const organization = useOrganization();
  const breakpoints = useBreakpoints();
  const selectedImage = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    return isPairSidebarItem(selectedItem)
      ? selectedItem.pairs[variantIndex]?.head_image
      : selectedItem.images[variantIndex];
  }, [selectedItem, variantIndex]);
  const {isDark, toggleIsDark} = useCanvasTheme(
    selectedImage?.canvas_theme,
    selectedImage?.key // reused across images: resync the canvas on navigation
  );
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const {cardOffsets, totalCards} = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const item of listItems) {
      offsets.push(total);
      const count = isPairSidebarItem(item) ? item.pairs.length : item.images.length;
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

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      onViewModeChange(mode);
      trackAnalytics('preprod.snapshots.details.view_mode_changed', {
        organization,
        view_mode: mode,
      });
    },
    [onViewModeChange, organization]
  );

  const handleDiffModeChange = useCallback(
    (mode: DiffMode) => {
      onDiffModeChange(mode);
      trackAnalytics('preprod.snapshots.details.diff_mode_changed', {
        organization,
        diff_mode: mode,
      });
    },
    [onDiffModeChange, organization]
  );

  const toggle = (
    <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
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
  const diffControls = hasChangedInList ? (
    <Fragment>
      {diffMode === 'split' && (
        <ColorPickerButton
          color={overlayColor}
          onChange={onOverlayColorChange}
          opacity={overlayOpacity}
          onOpacityChange={onOverlayOpacityChange}
        />
      )}
      <DiffModeToggle
        diffMode={diffMode}
        onDiffModeChange={handleDiffModeChange}
        showSplit={breakpoints.sm}
      />
    </Fragment>
  ) : null;
  const soloDiffToggle = hasDiffComparison ? (
    <SoloDiffToggle isSoloView={isSoloView} onToggleSoloView={onToggleSoloView} />
  ) : null;

  if (viewMode === 'list') {
    return (
      <Stack gap="0" padding="0" height="100%" width="100%" background="secondary">
        <ToolbarContainer
          toggle={toggle}
          sortDropdown={sortDropdown}
          progressIndicator={progressIndicator}
          diffControls={diffControls}
          soloDiffToggle={soloDiffToggle}
        />
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
          overlayOpacity={overlayOpacity}
          diffImageBaseUrl={diffImageBaseUrl}
          onVisibleGroupChange={onVisibleGroupChange}
        />
      </Stack>
    );
  }

  if (!selectedItem) {
    return (
      <Stack gap="0" padding="0" height="100%" width="100%">
        <ToolbarContainer
          toggle={toggle}
          sortDropdown={sortDropdown}
          progressIndicator={progressIndicator}
          soloDiffToggle={soloDiffToggle}
        />
        <Flex align="center" justify="center" padding="3xl" width="100%" flex="1">
          <Text variant="muted">{t('Select an image from the sidebar.')}</Text>
        </Flex>
      </Stack>
    );
  }

  const groupName = isItemUngrouped(selectedItem) ? null : selectedItem.name;

  if (selectedItem.type === 'changed' || selectedItem.type === 'errored') {
    const currentPair = selectedItem.pairs[variantIndex];
    if (!currentPair) {
      return null;
    }
    const image = currentPair.head_image;
    const isChanged = selectedItem.type === 'changed';
    return (
      <SingleViewLayout
        isDark={isDark}
        onToggleDark={toggleIsDark}
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
          tags: image.tags,
          status: isChanged ? DiffStatus.CHANGED : DiffStatus.ERRORED,
          diffPercent: currentPair.diff,
          copyData: currentPair,
          copyUrl: buildSnapshotLink(image.image_file_name),

          onCopyLink: () =>
            trackAnalytics('preprod.snapshots.details.image_link_copied', {
              organization,
              diff_status: selectedItem.type,
            }),
          onCopyMetadata: () =>
            trackAnalytics('preprod.snapshots.details.image_metadata_copied', {
              organization,
              diff_status: selectedItem.type,
            }),
        }}
        diffControls={isChanged ? diffControls : undefined}
        banner={isChanged ? undefined : <ErroredBanner />}
        body={
          <DiffImageDisplay
            pair={currentPair}
            imageBaseUrl={imageBaseUrl}
            diffImageBaseUrl={diffImageBaseUrl}
            overlayColor={overlayColor}
            overlayOpacity={overlayOpacity}
            diffMode={isChanged ? diffMode : 'split'}
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
    const imageUrl = getSnapshotImageUrl(imageBaseUrl, image);
    return (
      <SingleViewLayout
        isDark={isDark}
        onToggleDark={toggleIsDark}
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
          tags: image.tags,
          status: DiffStatus.RENAMED,
          copyData: currentPair,
          copyUrl: buildSnapshotLink(image.image_file_name),

          onCopyLink: () =>
            trackAnalytics('preprod.snapshots.details.image_link_copied', {
              organization,
              diff_status: 'renamed',
            }),
          onCopyMetadata: () =>
            trackAnalytics('preprod.snapshots.details.image_metadata_copied', {
              organization,
              diff_status: 'renamed',
            }),
        }}
        body={<SingleImageDisplay imageUrl={imageUrl} alt={getImageName(image)} />}
      />
    );
  }

  const currentImage = selectedItem.images[variantIndex];
  if (!currentImage) {
    return null;
  }
  const imageUrl = getSnapshotImageUrl(imageBaseUrl, currentImage);
  let status: DiffStatus | null;
  switch (selectedItem.type) {
    case 'solo':
      status = null;
      break;
    case 'added':
      status = DiffStatus.ADDED;
      break;
    case 'removed':
      status = DiffStatus.REMOVED;
      break;
    case 'skipped':
      status = DiffStatus.SKIPPED;
      break;
    case 'unchanged':
    default:
      status = DiffStatus.UNCHANGED;
  }

  return (
    <SingleViewLayout
      isDark={isDark}
      onToggleDark={toggleIsDark}
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
        tags: currentImage.tags,
        status,
        copyData: currentImage,
        copyUrl: buildSnapshotLink(currentImage.image_file_name),
        onCopyLink: () =>
          trackAnalytics('preprod.snapshots.details.image_link_copied', {
            organization,
            diff_status: status ? selectedItem.type : null,
          }),
        onCopyMetadata: () =>
          trackAnalytics('preprod.snapshots.details.image_metadata_copied', {
            organization,
            diff_status: status ? selectedItem.type : null,
          }),
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
  banner,
  diffControls,
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
  banner?: React.ReactNode;
  diffControls?: React.ReactNode;
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
      {banner}
      <Stack flex="1" minHeight="0">
        {body}
      </Stack>
    </SnapshotVariantFrame>
  );
  return (
    <Stack
      gap="0"
      padding="0"
      height="100%"
      width="100%"
      background="secondary"
      onClick={e => e.stopPropagation()}
    >
      <ToolbarContainer
        toggle={toggle}
        sortDropdown={sortDropdown}
        progressIndicator={progressIndicator}
        diffControls={diffControls}
        soloDiffToggle={soloDiffToggle}
      />
      <SingleViewScroll ref={scrollRef}>
        <Flex direction="row" gap="xl" flex="1" minHeight="0" align="stretch">
          <Stack flex="1" minWidth="0">
            <DarkAware isDark={isDark}>
              <SnapshotCardFrame groupName={groupName} fillHeight>
                {card}
              </SnapshotCardFrame>
            </DarkAware>
          </Stack>
          <Container
            flexShrink={0}
            onClick={e => e.stopPropagation()}
            display={{'screen:2xs': 'none', 'screen:sm': 'block'}}
          >
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
    </Stack>
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

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    padding-left: 0;
    padding-right: 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) and (max-width: ${p =>
    p.theme.breakpoints.md}) {
    padding-left: ${p => p.theme.space.xl};
  }
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
