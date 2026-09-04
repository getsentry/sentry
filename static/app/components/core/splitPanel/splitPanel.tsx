import {useCallback, useImperativeHandle, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {DRAG_HANDLE_SIZE, DragHandle} from '@sentry/scraps/dragHandle';
import {Flex, type Responsive, Stack} from '@sentry/scraps/layout';
import {useResponsivePropValue} from '@sentry/scraps/layout/styles';
import {useTranslation} from '@sentry/scraps/translationContext';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

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
  /** Fires once when a drag ends. */
  onResizeEnd?: (payload: {
    direction: 'increase' | 'decrease';
    endSize: number;
    startSize: number;
  }) => void;
  /** Layout direction. Accepts a responsive value. */
  orientation?: Responsive<'horizontal' | 'vertical'>;
  /** Imperative handle exposing `setSize`. */
  ref?: React.Ref<SplitPanelHandle>;
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

export function SplitPanel({
  sized,
  fill,
  ref,
  orientation: orientationProp = 'horizontal',
  defaultSize,
  initialSize = defaultSize,
  minSize = 0,
  maxSize,
  fillMinSize = 0,
  onResizeEnd,
}: SplitPanelProps) {
  const {t} = useTranslation();
  const orientation =
    useResponsivePropValue(orientationProp) === 'vertical' ? 'vertical' : 'horizontal';
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
      ? Math.max(
          min,
          Math.min(explicitMax, availableSize - fillMinSize - DRAG_HANDLE_SIZE)
        )
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

  const [isHeld, setIsHeld] = useState(false);
  const dragStateRef = useRef<{size: number; startSize: number} | null>(null);

  const {setSize, size: containerSize} = useResizableDrawer({
    direction: orientation === 'horizontal' ? 'left' : 'down',
    initialSize,
    min,
    max,
  });

  useImperativeHandle(ref, () => ({setSize}), [setSize]);

  // Clamped to [min, max] so the pane basis and divider aria-valuenow stay in
  // step — and never go negative when a seeded/persisted size is below min
  // (e.g. a saved size larger than the current viewport). The handlers reuse
  // this so the reported startSize and keyboard stepping match the rendered
  // size rather than the raw (possibly out-of-range) containerSize.
  const visibleSize = Math.max(min, Math.min(containerSize, max));

  const handleDoubleClick = () => {
    const target = Math.max(min, Math.min(defaultSize, max));
    setSize(target, true);
    handleResizeEnd(visibleSize, target);
  };

  const handleMoveStart = () => {
    dragStateRef.current = {size: visibleSize, startSize: visibleSize};
    setIsHeld(true);
  };

  const handleMove = (delta: number) => {
    const state = dragStateRef.current;
    if (!state) {
      return;
    }

    state.size = Math.max(min, Math.min(max, state.size + delta));

    setSize(Math.round(state.size), true);
  };

  const handleMoveEnd = () => {
    const state = dragStateRef.current;
    dragStateRef.current = null;
    setIsHeld(false);

    if (state) {
      handleResizeEnd(state.startSize, Math.round(state.size));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    let newSize: number | null = null;
    if (event.key === 'Home') {
      newSize = min;
    } else if (event.key === 'End') {
      newSize = max;
    }

    // Skip when the target is an unbounded max (not yet measured).
    if (newSize !== null && Number.isFinite(newSize)) {
      event.preventDefault();
      setSize(newSize, true);
      handleResizeEnd(visibleSize, newSize);
    }
  };

  // Ordered sized -> divider -> fill. Keys keep pane identity.
  const panes = [
    <Pane key="sized" size={hasFill ? visibleSize : null}>
      {sized}
    </Pane>,
  ];
  if (hasFill) {
    panes.push(
      <DragHandle
        key="divider"
        aria-label={t('Resize panels')}
        isSizedFirst
        max={max}
        min={min}
        orientation={orientation}
        value={visibleSize}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onMoveStart={handleMoveStart}
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
          {panes}
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
