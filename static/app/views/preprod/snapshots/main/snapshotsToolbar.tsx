import type React from 'react';
import {Fragment, useEffect, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

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

// Diagonal slash drawn across an empty/transparent swatch. `halfWidth` is the
// half-thickness of the line in px, so larger swatches can use a bolder slash.
const slashGradient = (theme: Theme, halfWidth: number) => css`
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background-image: linear-gradient(
    to top right,
    transparent calc(50% - ${halfWidth + 1}px),
    ${theme.tokens.content.danger} calc(50% - ${halfWidth}px),
    ${theme.tokens.content.danger} calc(50% + ${halfWidth}px),
    transparent calc(50% + ${halfWidth + 1}px)
  );
`;

export type ViewMode = 'single' | 'list';
export type SortBy = 'diff' | 'alpha';

interface ToolbarContainerProps {
  toggle: React.ReactNode;
  diffControls?: React.ReactNode;
  progressIndicator?: React.ReactNode;
  soloDiffToggle?: React.ReactNode;
  sortDropdown?: React.ReactNode;
}

export function ToolbarContainer({
  toggle,
  sortDropdown,
  progressIndicator,
  diffControls,
  soloDiffToggle,
}: ToolbarContainerProps) {
  return (
    <Fragment>
      <Flex
        align="center"
        justify="between"
        gap="md"
        padding={{'screen:xs': 'md xl', 'screen:md': 'md xl md 0'}}
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
          <Flex
            display={{'screen:2xs': 'none', 'screen:xs': 'none', 'screen:sm': 'flex'}}
          >
            {soloDiffToggle}
          </Flex>
        </Flex>
      </Flex>
      <Separator orientation="horizontal" />
    </Fragment>
  );
}

export function SoloDiffToggle({
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

export function ViewModeToggle({
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

export function SortDropdown({
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

const OPACITY_PRESETS = [0, 50, 100];

export function ColorPickerButton({
  color,
  onChange,
  opacity,
  onOpacityChange,
}: {
  color: string;
  onChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  opacity: number;
}) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const palette = theme.chart.getColorPalette(10);

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
          $color={color}
          // `transparent` supports legacy localStorage color values.
          $slash={opacity === 0 || color === TRANSPARENT_COLOR}
          aria-label={t('Pick overlay color')}
          onClick={() => setIsOpen(v => !v)}
        />
      </Tooltip>
      {isOpen && (
        <ColorPickerDropdown>
          <Flex gap="xs" align="center">
            <Text size="xs" variant="muted">
              {t('Opacity')}
            </Text>
            {OPACITY_PRESETS.map(preset => (
              <Tooltip key={preset} title={t('%s opacity', `${preset}%`)} skipWrapper>
                <OpacitySwatch
                  $selected={opacity === preset}
                  aria-pressed={opacity === preset}
                  onClick={() => onOpacityChange(preset)}
                  aria-label={t('Overlay opacity %s', `${preset}%`)}
                >
                  <OpacitySwatchFill $color={color} $opacity={preset} />
                </OpacitySwatch>
              </Tooltip>
            ))}
            <PickerDivider />
            <Text size="xs" variant="muted">
              {t('Color')}
            </Text>
            {palette.map(c => (
              <ColorSwatch
                key={c}
                $color={c}
                $selected={color === c}
                onClick={() => onChange(c)}
                aria-label={t('Overlay color %s', c)}
              />
            ))}
          </Flex>
        </ColorPickerDropdown>
      )}
    </ColorPickerWrapper>
  );
}

export function DiffModeToggle({
  diffMode,
  onDiffModeChange,
  showSplit,
}: {
  diffMode: DiffMode;
  onDiffModeChange: (mode: DiffMode) => void;
  showSplit: boolean;
}) {
  const splitLabel = t('Split');
  const wipeLabel = t('Wipe');
  const onionLabel = t('Onion');

  return (
    <SegmentedControl size="xs" value={diffMode} onChange={onDiffModeChange}>
      {showSplit ? (
        <SegmentedControl.Item
          key="split"
          icon={<IconPause />}
          aria-label={splitLabel}
          tooltip={splitLabel}
        >
          {diffMode === 'split' ? splitLabel : undefined}
        </SegmentedControl.Item>
      ) : null}
      <SegmentedControl.Item
        key="wipe"
        icon={<IconInput />}
        aria-label={wipeLabel}
        tooltip={wipeLabel}
      >
        {diffMode === 'wipe' ? wipeLabel : undefined}
      </SegmentedControl.Item>
      <SegmentedControl.Item
        key="onion"
        icon={<IconStack />}
        aria-label={onionLabel}
        tooltip={onionLabel}
      >
        {diffMode === 'onion' ? onionLabel : undefined}
      </SegmentedControl.Item>
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

const ColorTrigger = styled('button')<{$color: string; $slash: boolean}>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  border: 1px solid
    ${p => p.theme.tokens.border.onVibrant[p.theme.type === 'dark' ? 'light' : 'dark']};
  background-color: ${p => (p.$slash ? 'transparent' : p.$color)};
  ${p => p.$slash && slashGradient(p.theme, 1)}

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;

export const ProgressPill = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

export const ProgressCounter = styled(Text)`
  white-space: nowrap;
  font-family: ${p => p.theme.font.family.mono};
`;

export const ToolbarProgressBar = styled(ProgressBar)`
  width: 50px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const OpacitySwatch = styled('button')<{$selected: boolean}>`
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  background: none;
  border: 2px solid
    ${p => (p.$selected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  outline: ${p => (p.$selected ? `2px solid ${p.theme.tokens.focus.default}` : 'none')};
  outline-offset: 1px;

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;

const OpacitySwatchFill = styled('div')<{$color: string; $opacity: number}>`
  position: absolute;
  inset: 0;
  background: ${p =>
    p.$color === TRANSPARENT_COLOR
      ? 'transparent'
      : `linear-gradient(to right, ${p.$color} ${p.$opacity}%, transparent ${p.$opacity}%)`};
  ${p =>
    p.$opacity === 0 &&
    css`
      ${slashGradient(p.theme, 0.5)}
    `}
`;

const PickerDivider = styled('div')`
  align-self: stretch;
  min-height: 20px;
  margin: 0 ${p => p.theme.space.xs};
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ColorSwatch = styled('button')<{$color: string; $selected: boolean}>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid
    ${p => (p.$selected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  background-color: ${p => p.$color};
  padding: 0;
  outline: ${p => (p.$selected ? `2px solid ${p.theme.tokens.focus.default}` : 'none')};
  outline-offset: 1px;
`;
