import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {
  Container,
  Flex,
  type Responsive,
  useResponsivePropValue,
} from '@sentry/scraps/layout';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

type Orientation = 'horizontal' | 'vertical';

/**
 * Which side of the divider the `sized` pane sits on. `start` is left
 * (horizontal) or top (vertical); `end` is right or bottom. Orientation-neutral
 * so it stays correct when `orientation` is responsive.
 */
type Placement = 'start' | 'end';

// The divider renders as a 1px border; account for it when deriving the max.
const DIVIDER_SIZE = 1;

type SplitPanelProps = {
  /**
   * The `sized` pane's initial size in pixels, and the size restored on
   * double-click.
   */
  defaultSize: number;
  /**
   * The pane with a controlled, draggable size. Fills the container (no
   * divider, size props ignored) when `fill` is omitted.
   */
  sized: React.ReactNode;
  /** The pane that absorbs the remaining space. */
  fill?: React.ReactNode;
  /**
   * The `fill` pane's minimum size in pixels. The `sized` pane's max is derived
   * from this and the measured container, so consumers don't compute
   * "container − other pane − divider" by hand.
   */
  fillMinSize?: number;
  /**
   * Initial size of the `sized` pane, e.g. a value restored from persistence.
   * Seeds the starting size only; `defaultSize` stays the double-click reset
   * target. Defaults to `defaultSize`.
   */
  initialSize?: number;
  /** Optional hard cap on the `sized` pane, tighter than the derived max. */
  maxSize?: number;
  /** The `sized` pane's minimum size in pixels. */
  minSize?: number;
  /** Fires on drag start with the `sized` pane's current size. */
  onMouseDown?: (size: number) => void;
  /** Fires during drag with the new size. Wire to your own persistence. */
  onResize?: (newSize: number) => void;
  /** Fires once on mouseUp with the start/end sizes and a derived direction. */
  onResizeEnd?: (payload: {
    direction: 'increase' | 'decrease';
    endSize: number;
    startSize: number;
  }) => void;
  /**
   * Layout direction. Accepts a responsive value, e.g.
   * `{xs: 'vertical', md: 'horizontal'}`.
   */
  orientation?: Responsive<Orientation>;
  /** Which side the `sized` pane sits on. Defaults to `start`. */
  placement?: Placement;
};

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
    <Flex
      direction="column"
      minHeight="0"
      minWidth="0"
      flexGrow={isFilling ? 1 : 0}
      flexShrink={isFilling ? 1 : 0}
      flexBasis={isFilling ? 0 : `${size}px`}
    >
      {children}
    </Flex>
  );
}

type SplitDividerProps = {
  isHeld: boolean;
  isSizedFirst: boolean;
  max: number;
  min: number;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onMouseDown: React.MouseEventHandler<HTMLElement>;
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
  onMouseDown,
}: SplitDividerProps) {
  const cursor = getDividerCursor(
    orientation,
    value <= min,
    Number.isFinite(max) && value >= max,
    isSizedFirst
  );

  return (
    <Container position="relative" flexShrink={0}>
      {({className}) => (
        <DividerLine
          className={className}
          $cursor={cursor}
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={min}
          aria-valuenow={value}
          data-is-held={isHeld}
          data-orientation={orientation}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          onMouseDown={onMouseDown}
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
  orientation: orientationProp = 'horizontal',
  placement = 'start',
  defaultSize,
  initialSize = defaultSize,
  minSize = 0,
  maxSize,
  fillMinSize = 0,
  onMouseDown,
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
    onMouseDown: onDragStart,
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
    onResizeEnd: ({startSize, endSize}) =>
      handleResizeEnd(Math.min(startSize, max), Math.min(endSize, max)),
  });

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onMouseDown?.(Math.min(containerSize, max));
      onDragStart(event);
    },
    [onDragStart, containerSize, max, onMouseDown]
  );

  const handleDoubleClick = useCallback(() => {
    const startSize = Math.min(containerSize, max);
    const target = Math.max(min, Math.min(defaultSize, max));
    setSize(target, true);
    handleResizeEnd(startSize, target);
  }, [containerSize, max, min, defaultSize, setSize, handleResizeEnd]);

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
      const current = Math.min(containerSize, max);

      let newSize: number | null = null;
      if (event.key === shrinkKey) {
        newSize = Math.max(min, current - step);
      } else if (event.key === growKey) {
        newSize = Math.min(max, current + step);
      } else if (event.key === 'Home') {
        // Separator to the start edge.
        newSize = isSizedFirst ? min : max;
      } else if (event.key === 'End' && Number.isFinite(max)) {
        // Separator to the end edge.
        newSize = isSizedFirst ? max : min;
      }

      if (newSize !== null) {
        event.preventDefault();
        setSize(newSize, true);
        handleResizeEnd(current, newSize);
      }
    },
    [orientation, isSizedFirst, containerSize, min, max, setSize, handleResizeEnd]
  );

  // Clamped so the pane basis and divider aria-valuenow stay in step.
  const visibleSize = Math.min(containerSize, max);

  // Ordered sized → divider → fill; reversed for `placement="end"`. Keys keep
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
        onMouseDown={handleMouseDown}
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
  cursor: ${p => p.$cursor};

  /* Invisible wider hit area for dragging */
  &::before {
    content: '';
    position: absolute;
    z-index: 1;
  }

  /* Accent bar that lights up on hover/drag */
  &::after {
    content: '';
    position: absolute;
    z-index: 1;
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
    height: 100%;
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
