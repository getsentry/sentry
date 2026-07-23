import {useCallback, useImperativeHandle, useRef} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, type Responsive, Stack} from '@sentry/scraps/layout';
import {useResponsivePropValue} from '@sentry/scraps/layout/styles';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

type Orientation = 'horizontal' | 'vertical';

// The divider renders as a 1px border; account for it when deriving the max.
const DIVIDER_SIZE = 1;

export interface SplitPanelHandle {
  /**
   * Imperatively set the `sized` pane's size (px). Useful to seed the size from
   * a measurement the parent takes after mount, without remounting (and thus
   * without the parent gating the whole panel on its own measurement).
   */
  setSize: (size: number, userEvent?: boolean) => void;
}

interface SplitPanelProps {
  /** Initial size of the `sized` pane in pixels; restored on double-click. */
  defaultSize: number;
  /** The pane with a draggable size. */
  sized: React.ReactNode;
  /** The pane that fills the remaining space. Omit to render a single pane. */
  fill?: React.ReactNode;
  /** Minimum size of the `fill` pane in pixels. */
  fillMinSize?: number;
  /** Starting size, e.g. restored from persistence. Defaults to `defaultSize`. */
  initialSize?: number;
  maxSize?: number;
  minSize?: number;
  /** Fires during drag with the new size. */
  onResize?: (newSize: number) => void;
  /** Fires once when a drag ends. */
  onResizeEnd?: (payload: {
    direction: 'increase' | 'decrease';
    endSize: number;
    startSize: number;
  }) => void;
  /** Layout direction. Accepts a responsive value. */
  orientation?: Responsive<'horizontal' | 'vertical'>;
  /** Which side the `sized` pane sits on. Defaults to `start`. */
  placement?: 'start' | 'end';
  /** Imperative handle exposing `setSize`. */
  ref?: React.Ref<SplitPanelHandle>;
}

// At a limit the divider can only travel one way, so point the cursor that way;
// the grow/shrink direction flips when the sized pane sits after the divider.
function getDividerCursor(
  orientation: Orientation,
  atMin: boolean,
  atMax: boolean,
  isSizedFirst: boolean
): React.CSSProperties['cursor'] {
  if (orientation === 'horizontal') {
    if (atMin) {
      return isSizedFirst ? 'e-resize' : 'w-resize';
    }
    if (atMax) {
      return isSizedFirst ? 'w-resize' : 'e-resize';
    }
    return 'ew-resize';
  }
  if (atMin) {
    return isSizedFirst ? 's-resize' : 'n-resize';
  }
  if (atMax) {
    return isSizedFirst ? 'n-resize' : 's-resize';
  }
  return 'ns-resize';
}

// `size === null` fills the remaining space; otherwise it takes a fixed basis.
function Pane({size, children}: {children: React.ReactNode; size: number | null}) {
  const isFilling = size === null;
  return (
    <Stack
      minHeight="0"
      minWidth="0"
      flexGrow={isFilling ? 1 : 0}
      flexShrink={isFilling ? 1 : 0}
      flexBasis={isFilling ? 0 : `${size}px`}
    >
      {children}
    </Stack>
  );
}

type SplitDividerProps = {
  isHeld: boolean;
  isSizedFirst: boolean;
  max: number;
  min: number;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  orientation: Orientation;
  value: number;
};

function SplitDivider({
  isHeld,
  isSizedFirst,
  max,
  min,
  orientation,
  value,
  onDoubleClick,
  onKeyDown,
  onPointerDown,
}: SplitDividerProps) {
  const cursor = getDividerCursor(
    orientation,
    value <= min,
    Number.isFinite(max) && value >= max,
    isSizedFirst
  );

  return (
    <Container position="relative" flexShrink={0}>
      {containerProps => (
        <DividerLine
          {...containerProps}
          $cursor={cursor}
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={min}
          aria-valuenow={value}
          data-is-held={isHeld}
          data-orientation={orientation}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          role="separator"
          tabIndex={0}
        />
      )}
    </Container>
  );
}

export function SplitPanel({
  sized,
  fill,
  ref,
  orientation: orientationProp = 'horizontal',
  placement = 'start',
  defaultSize,
  initialSize = defaultSize,
  minSize = 0,
  maxSize,
  fillMinSize = 0,
  onResize,
  onResizeEnd,
}: SplitPanelProps) {
  // The hook's return type widens to the responsive shape; narrow by value.
  const orientation =
    useResponsivePropValue(orientationProp) === 'vertical' ? 'vertical' : 'horizontal';
  const isSizedFirst = placement === 'start';
  const hasFill = fill !== undefined && fill !== null;

  const containerRef = useRef<HTMLDivElement>(null);
  const dims = useDimensions({elementRef: containerRef});
  const availableSize = orientation === 'horizontal' ? dims.width : dims.height;

  const min = minSize;
  const explicitMax = maxSize ?? Number.POSITIVE_INFINITY;
  // Cap so the sized pane can't overflow or push the fill pane below its min.
  // Floored at min; falls back to the explicit max until we've measured.
  const max =
    availableSize > 0
      ? Math.max(min, Math.min(explicitMax, availableSize - fillMinSize - DIVIDER_SIZE))
      : explicitMax;

  const handleResizeEnd = useCallback(
    (startSize: number, endSize: number) => {
      if (startSize === endSize) {
        return;
      }
      onResizeEnd?.({
        startSize,
        endSize,
        direction: endSize > startSize ? 'increase' : 'decrease',
      });
    },
    [onResizeEnd]
  );

  const {
    isHeld,
    onPointerDown,
    setSize,
    size: containerSize,
  } = useResizableDrawer({
    // Flip the drag axis when the sized pane sits after the divider.
    direction:
      orientation === 'horizontal'
        ? isSizedFirst
          ? 'left'
          : 'right'
        : isSizedFirst
          ? 'down'
          : 'up',
    initialSize,
    min,
    max,
    onResize: newSize => onResize?.(newSize),
    onResizeEnd: ({startSize, endSize}) => handleResizeEnd(startSize, endSize),
  });

  useImperativeHandle(ref, () => ({setSize}), [setSize]);

  // Clamped to [min, max] so the pane basis and divider aria-valuenow stay in
  // step — and never go negative when a seeded/persisted size is below min
  // (e.g. a saved size larger than the current viewport). The handlers reuse
  // this so the reported startSize and keyboard stepping match the rendered
  // size rather than the raw (possibly out-of-range) containerSize.
  const visibleSize = Math.max(min, Math.min(containerSize, max));

  const handleDoubleClick = useCallback(() => {
    const target = Math.max(min, Math.min(defaultSize, max));
    setSize(target, true);
    handleResizeEnd(visibleSize, target);
  }, [visibleSize, max, min, defaultSize, setSize, handleResizeEnd]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? 50 : 10;
      const isHorizontal = orientation === 'horizontal';
      const towardStartKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
      const towardEndKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

      // Keys map to physical separator direction; moving it toward `end` grows
      // the sized pane only when it sits first, and shrinks it otherwise.
      const growKey = isSizedFirst ? towardEndKey : towardStartKey;
      const shrinkKey = isSizedFirst ? towardStartKey : towardEndKey;

      // Step from the visible size so it still moves after the container shrank.
      const current = visibleSize;

      let newSize: number | null = null;
      if (event.key === shrinkKey) {
        newSize = Math.max(min, current - step);
      } else if (event.key === growKey) {
        newSize = Math.min(max, current + step);
      } else if (event.key === 'Home') {
        // Separator to the start edge.
        newSize = isSizedFirst ? min : max;
      } else if (event.key === 'End') {
        // Separator to the end edge.
        newSize = isSizedFirst ? max : min;
      }

      // Skip when the target is an unbounded max (not yet measured); min and
      // stepped targets are always finite, so this only gates the edge keys.
      if (newSize !== null && Number.isFinite(newSize)) {
        event.preventDefault();
        setSize(newSize, true);
        handleResizeEnd(current, newSize);
      }
    },
    [orientation, isSizedFirst, visibleSize, min, max, setSize, handleResizeEnd]
  );

  // Ordered sized -> divider -> fill; reversed for `placement="end"`. Keys keep
  // pane identity across the flip.
  const panes = [
    <Pane key="sized" size={hasFill ? visibleSize : null}>
      {sized}
    </Pane>,
  ];
  if (hasFill) {
    panes.push(
      <SplitDivider
        key="divider"
        isHeld={isHeld}
        isSizedFirst={isSizedFirst}
        max={max}
        min={min}
        orientation={orientation}
        value={visibleSize}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
      />,
      <Pane key="fill" size={null}>
        {fill}
      </Pane>
    );
  }

  return (
    <Flex
      direction={orientation === 'horizontal' ? 'row' : 'column'}
      position="relative"
      width="100%"
      height="100%"
      minHeight="0"
      minWidth="0"
      flex="1"
    >
      {({className}) => (
        <RootElement
          ref={containerRef}
          className={className}
          data-is-held={isHeld}
          // Hide until measured to avoid a fill-pane flash before the sized
          // pane gets its basis.
          style={hasFill && availableSize === 0 ? {visibility: 'hidden'} : undefined}
        >
          {isSizedFirst ? panes : [...panes].reverse()}
        </RootElement>
      )}
    </Flex>
  );
}

const RootElement = styled('div')`
  /*
   * Disable iframe pointer events while dragging so the divider doesn't lose the
   * cursor when crossing an embedded iframe (e.g. the Replay player). The
   * triple-& raises specificity so this beats the player's own
   * [data-inspectable] .replayer-wrapper > iframe !important rule, which would
   * otherwise tie and make the drag intermittently stick over the video.
   */
  &&&[data-is-held='true'] iframe {
    pointer-events: none !important;
  }
`;

const DividerLine = styled('div')<{$cursor: React.CSSProperties['cursor']}>`
  user-select: none;
  touch-action: none;
  cursor: ${p => p.$cursor};

  /* Invisible wider hit area for dragging */
  &::before {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
  }

  /* Accent bar that lights up on hover/drag */
  &::after {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow} 0.1s;
  }

  &:hover::after,
  &[data-is-held='true']::after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }

  &[data-orientation='horizontal'] {
    width: 0;
    height: auto;
    align-self: stretch;
    border-left: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: 0 auto 0 -5px;
      width: 11px;
    }

    &::after {
      inset: 0 auto 0 -2px;
      width: 4px;
    }
  }

  &[data-orientation='vertical'] {
    width: 100%;
    height: 0;
    border-top: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: -5px 0 auto 0;
      height: 11px;
    }

    &::after {
      inset: -2px 0 auto 0;
      height: 4px;
    }
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
