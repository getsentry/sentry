import type React from 'react';
import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
import {Card, CardHeader, DarkAware} from './snapshotCards';
import {
  buildSnapshotLink,
  GroupHeader,
  isItemUngrouped,
  SnapshotListView,
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
  onSelectSnapshot?: (key: string | null) => void;
  onSortByChange?: (sort: SortBy) => void;
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
  selectedSnapshotKey,
  onSelectSnapshot,
  sortBy = 'diff',
  onSortByChange,
  onNavigateSingleView,
  canNavigatePrev,
  canNavigateNext,
  navButtonRefs,
}: SnapshotMainContentProps) {
  const [isDark, setIsDark] = useState(false);
  const toggleDark = () => setIsDark(v => !v);

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
          </Flex>
          <Flex align="center" gap="md" onClick={e => e.stopPropagation()}>
            {listDiffControls}
            {soloDiffToggle}
          </Flex>
        </Flex>
        <Separator orientation="horizontal" />
        <SnapshotListView
          items={listItems}
          imageBaseUrl={imageBaseUrl}
          headBranch={headBranch}
          selectedSnapshotKey={selectedSnapshotKey}
          onSelectSnapshot={onSelectSnapshot}
          onOpenSnapshot={handleOpenSnapshot}
          diffMode={diffMode}
          overlayColor={overlayColor}
          diffImageBaseUrl={diffImageBaseUrl}
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
  soloDiffToggle: React.ReactNode;
  toggle: React.ReactNode;
  rightControls?: React.ReactNode;
}) {
  const card = (
    <SingleViewCard isDark={isDark} isSelected={false}>
      <CardHeader {...headerProps} isDark={isDark} onToggleDark={onToggleDark} />
      <SingleViewBody>{body}</SingleViewBody>
    </SingleViewCard>
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
        {toggle}
        <Flex align="center" gap="md">
          {rightControls}
          {soloDiffToggle}
        </Flex>
      </Flex>
      <Separator orientation="horizontal" />
      <SingleViewScroll>
        <Flex direction="row" gap="xl" flex="1" minHeight="0" align="stretch">
          <Flex direction="column" flex="1" minWidth="0">
            <DarkAware isDark={isDark}>
              {groupName ? (
                <SingleViewGroup>
                  <GroupHeader name={groupName} />
                  {card}
                </SingleViewGroup>
              ) : (
                card
              )}
            </DarkAware>
          </Flex>
          <NavGutter onClick={e => e.stopPropagation()}>
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
      return undefined;
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

const SingleViewGroup = styled(Stack)`
  flex: 1 1 0;
  min-height: 0;
  padding: ${p => p.theme.space.lg};
  gap: ${p => p.theme.space.md};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

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

// Sticky + vertically centered so the nav arrows sit at the viewport's
// vertical center and stay reachable as the user scrolls tall images.
const NavGutter = styled('div')`
  position: sticky;
  top: 50%;
  transform: translateY(-50%);
  align-self: flex-start;
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

const SingleViewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
`;

const SingleViewBody = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
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
