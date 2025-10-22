import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {IconChevron, IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface Side {
  content: React.ReactNode;
  default: number;
  max: number;
  min: number;
}

interface DockableSplitPanelProps {
  availableSize: number;
  left: Side;
  right: React.ReactNode;
  dockThreshold?: number;
  leftLabel?: string;
  onResize?: (newSize: number) => void;
  rightLabel?: string;
  sizeStorageKey?: string;
}

export function DockableSplitPanel({
  availableSize,
  left,
  right,
  dockThreshold = 0.34,
  leftLabel,
  rightLabel,
  onResize,
  sizeStorageKey,
}: DockableSplitPanelProps) {
  const [dockedSide, setDockedSide] = useState<'left' | 'right' | 'none'>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isHeld,
    onDoubleClick,
    onMouseDown: onDragStart,
    size: containerSize,
    setSize,
  } = useResizableDrawer({
    direction: 'left',
    initialSize: left.default,
    min: left.min,
    onResize: onResize ?? (() => {}),
    sizeStorageKey,
  });

  // Track previous isHeld state to detect when dragging stops
  const prevIsHeld = useRef(isHeld);

  // Auto-dock when user stops dragging and panel is below threshold
  useEffect(() => {
    if (prevIsHeld.current && !isHeld && availableSize > 0 && dockedSide === 'none') {
      const leftPercentage = containerSize / availableSize;
      const rightPercentage = (availableSize - containerSize) / availableSize;

      console.log('leftPercentage', leftPercentage);
      console.log('rightPercentage', rightPercentage);
      console.log('dockThreshold', dockThreshold);
      console.log('dockedSide', dockedSide);
      console.log('isHeld', isHeld);
      console.log('availableSize', availableSize);
      console.log('containerSize', containerSize);

      // Dock if left panel is too small OR right panel is too small
      if (leftPercentage <= dockThreshold) {
        setDockedSide('left');
      } else if (rightPercentage <= dockThreshold) {
        setDockedSide('right');
      }
    }
    prevIsHeld.current = isHeld;
  }, [isHeld, containerSize, availableSize, dockThreshold, dockedSide]);

  // Only show as docked if explicitly docked
  const effectiveIsDocked = dockedSide !== 'none';

  const sizePct =
    `${(Math.min(containerSize, left.max) / availableSize) * 100}%` as const;

  const handleMouseDown = useCallback(
    (event: any) => {
      onDragStart(event);
    },
    [onDragStart]
  );

  const handleDockToggle = useCallback(() => {
    if (effectiveIsDocked) {
      // Undock: restore to default size
      setDockedSide('none');
      setSize(left.default);
    } else {
      // Manual dock: dock to right side by default
      setDockedSide('right');
    }
  }, [effectiveIsDocked, setSize, left.default]);

  if (effectiveIsDocked) {
    if (dockedSide === 'left') {
      // Left panel is docked, show right panel with left dock bar
      return (
        <DockedContainer ref={containerRef}>
          <DockedBar
            direction="left"
            onClick={handleDockToggle}
            aria-label="Undock panel"
          >
            <IconChevron isDouble direction="right" size="sm" />
            {leftLabel && <VerticalLabel>{leftLabel}</VerticalLabel>}
          </DockedBar>
          <DockedMainPanel>{right}</DockedMainPanel>
        </DockedContainer>
      );
    }
    // Right panel is docked, show left panel with right dock bar
    return (
      <DockedContainer ref={containerRef}>
        <DockedMainPanel>{left.content}</DockedMainPanel>
        <DockedBar direction="right" onClick={handleDockToggle} aria-label="Undock panel">
          <IconChevron isDouble direction="left" size="sm" />
          {rightLabel && <VerticalLabel>{rightLabel}</VerticalLabel>}
        </DockedBar>
      </DockedContainer>
    );
  }

  return (
    <SplitContainer ref={containerRef}>
      <SplitPanelContainer
        className={isHeld ? 'disable-iframe-pointer' : undefined}
        size={sizePct}
      >
        <Panel>{left.content}</Panel>
        <SplitDivider
          data-is-held={isHeld}
          onDoubleClick={onDoubleClick}
          onMouseDown={handleMouseDown}
        >
          <IconGrabbable size="sm" />
        </SplitDivider>
        <Panel>{right}</Panel>
      </SplitPanelContainer>
    </SplitContainer>
  );
}

const SplitContainer = styled('div')`
  min-height: 0;
  min-width: 0;
  flex-grow: 1;
  position: relative;
`;

const DockedContainer = styled('div')`
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
`;

const DockedMainPanel = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  min-height: 0;
  min-width: 0;
`;

const DockedBar = styled('button')<{direction: 'left' | 'right'}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 32px;
  background: ${p => p.theme.background};
  border: none;
  ${p =>
    p.direction === 'left'
      ? 'border-right: 1px solid ${p => p.theme.border};'
      : 'border-left: 1px solid ${p => p.theme.border};'};
  cursor: pointer;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(0.5)};
  flex-shrink: 0;

  &:hover {
    color: ${p => p.theme.textColor};
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const SplitPanelContainer = styled('div')<{
  size: `${number}px` | `${number}%`;
}>`
  min-height: 0;
  min-width: 0;
  flex-grow: 1;
  position: relative;
  display: grid;
  grid-template-columns: ${p => p.size} auto 1fr;
  height: 100%;

  &&.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;

const Panel = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  min-height: 0;
  min-width: 0;
`;

const SplitDivider = styled('div')`
  display: grid;
  place-items: center;
  height: 100%;
  width: 16px;
  background: inherit;
  cursor: col-resize;
  user-select: inherit;

  &:hover,
  &[data-is-held='true'] {
    background: ${p => p.theme.hover};
  }

  &[data-is-held='true'] {
    user-select: none;
  }
`;

const VerticalLabel = styled('span')`
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: ${p => p.theme.fontSize.xs};
  margin: ${space(0.5)} 0;
  white-space: nowrap;
`;
