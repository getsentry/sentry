import type React from 'react';
import {Fragment, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProgressBar} from 'sentry/components/progressBar';
import {IconExpand, IconInput, IconList, IconPause, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {DiffMode} from './imageDisplay/diffImageDisplay';

const TRANSPARENT_COLOR = 'transparent';

type ViewMode = 'single' | 'list';
type SortBy = 'diff' | 'alpha';

interface SnapshotsToolbarProps {
  toggle: React.ReactNode;
  diffControls?: React.ReactNode;
  progressIndicator?: React.ReactNode;
  soloDiffToggle?: React.ReactNode;
  sortDropdown?: React.ReactNode;
}

export function SnapshotsToolbar({
  toggle,
  sortDropdown,
  progressIndicator,
  diffControls,
  soloDiffToggle,
}: SnapshotsToolbarProps) {
  return (
    <Fragment>
      <Flex
        align="center"
        justify="between"
        gap="md"
        padding="md xl md 0"
        background="primary"
        onClick={e => e.stopPropagation()}
      >
        <Flex align="center" gap="md">
          {toggle}
          {sortDropdown}
          {progressIndicator}
        </Flex>
        <Flex align="center" gap="md">
          {diffControls && (
            <Flex align="center" gap="sm">
              {diffControls}
            </Flex>
          )}
          {soloDiffToggle}
        </Flex>
      </Flex>
      <Separator orientation="horizontal" />
    </Fragment>
  );
}

export function SnapshotsToolbarWithControls({
  viewMode,
  onViewModeChange,
  progress,
  sort,
  diff,
  solo,
}: {
  onViewModeChange: (mode: ViewMode) => void;
  viewMode: ViewMode;
  diff?: {
    mode: DiffMode;
    onModeChange: (mode: DiffMode) => void;
    onOverlayColorChange: (color: string) => void;
    overlayColor: string;
  };
  progress?: {
    current: number;
    percent: number;
    total: number;
  };
  solo?:
    | 'base'
    | {
        isActive: boolean;
        onToggle: () => void;
      };
  sort?: {
    onChange: (sort: SortBy) => void;
    value: SortBy;
  };
}) {
  let soloDiffToggle: React.ReactNode = null;
  if (solo === 'base') {
    soloDiffToggle = <Tag variant="promotion">{t('Base')}</Tag>;
  } else if (solo) {
    soloDiffToggle = (
      <SoloDiffToggle isSoloView={solo.isActive} onToggleSoloView={solo.onToggle} />
    );
  }

  return (
    <SnapshotsToolbar
      toggle={<ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />}
      sortDropdown={
        sort ? <SortDropdown value={sort.value} onChange={sort.onChange} /> : null
      }
      progressIndicator={
        progress ? (
          <ProgressPill>
            <ToolbarProgressBar value={progress.percent} />
            <ProgressCounter size="xs" variant="muted">
              {progress.current}/{progress.total}
            </ProgressCounter>
          </ProgressPill>
        ) : null
      }
      diffControls={
        diff ? (
          <Fragment>
            {diff.mode === 'split' && (
              <ColorPickerButton
                color={diff.overlayColor}
                onChange={diff.onOverlayColorChange}
              />
            )}
            <DiffModeToggle diffMode={diff.mode} onDiffModeChange={diff.onModeChange} />
          </Fragment>
        ) : null
      }
      soloDiffToggle={soloDiffToggle}
    />
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
