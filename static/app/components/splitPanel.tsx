import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

type Orientation = 'horizontal' | 'vertical';

type SplitPanelContextValue = {
  isHeld: boolean;
  max: number;
  min: number;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  orientation: Orientation;
  size: number;
};

const SplitPanelContext = createContext<SplitPanelContextValue | null>(null);

function useSplitPanelContext(component: string): SplitPanelContextValue {
  const ctx = useContext(SplitPanelContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <SplitPanel.Root>`);
  }
  return ctx;
}

type SplitPanelProps = {
  /**
   * Exactly one `<SplitPanel.Panel>` followed by an optional
   * `<SplitPanel.Divider>` and a second `<SplitPanel.Panel>`. When only one
   * `<SplitPanel.Panel>` is rendered, it fills the container.
   */
  children: React.ReactNode;
  /**
   * Fires when the user starts dragging the divider. Receives the current
   * size of the sized pane in pixels.
   */
  onMouseDown?: (size: number) => void;
  /**
   * Fires as the user drags. Receives the new size in pixels. Wire this to
   * your own persistence layer if you want to remember the size across
   * reloads (e.g. `useLocalStorageState`).
   */
  onResize?: (newSize: number) => void;
  /**
   * Fires once when a drag completes (on mouseUp). Receives the size at
   * drag start and end in pixels, plus a derived `direction`. Useful for
   * analytics like "did the user grow or shrink the pane?".
   */
  onResizeEnd?: (payload: {
    direction: 'increase' | 'decrease';
    endSize: number;
    startSize: number;
  }) => void;
  /**
   * Layout direction. `horizontal` splits left/right; `vertical` splits
   * top/bottom.
   */
  orientation?: Orientation;
};

type SplitPanelPanelProps = {
  children: React.ReactNode;
  /**
   * Initial size of this pane in pixels. The pane that declares `defaultSize`
   * is the sized pane; the other fills the remaining space. Only one pane may
   * be sized.
   */
  defaultSize?: number;
  /**
   * Maximum size in pixels the user may drag this pane to. Only meaningful on
   * the sized pane.
   */
  maxSize?: number;
  /**
   * Minimum size in pixels the user may drag this pane to. Only meaningful on
   * the sized pane.
   */
  minSize?: number;
};

function Panel({children}: SplitPanelPanelProps) {
  const {size, max} = useSplitPanelContext('SplitPanel.Panel');
  const isSized = useIsSizedPanel();

  // Clamp the rendered basis to `max` (capped at the container size) so the
  // sized pane can never overflow or squeeze out the fill pane when the
  // container shrinks without a drag, e.g. the window narrows.
  return (
    <Flex
      direction="column"
      minHeight="0"
      minWidth="0"
      flexGrow={isSized ? 0 : 1}
      flexShrink={isSized ? 0 : 1}
      flexBasis={isSized ? `${Math.min(size, max)}px` : 0}
    >
      {children}
    </Flex>
  );
}

const IsSizedPanelContext = createContext(false);
function useIsSizedPanel() {
  return useContext(IsSizedPanelContext);
}

function Divider() {
  const {isHeld, max, min, onDoubleClick, onKeyDown, onMouseDown, orientation, size} =
    useSplitPanelContext('SplitPanel.Divider');

  return (
    <Container position="relative" flexShrink={0}>
      {({className}) => (
        <DividerLine
          className={className}
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={min}
          aria-valuenow={size}
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

function isPanelElement(
  child: React.ReactNode
): child is React.ReactElement<SplitPanelPanelProps, typeof Panel> {
  return isValidElement(child) && child.type === Panel;
}

function isFragmentElement(
  child: React.ReactNode
): child is React.ReactElement<{children?: React.ReactNode}, typeof Fragment> {
  return isValidElement(child) && child.type === Fragment;
}

// React.Children doesn't descend into Fragments, so flatten them ourselves.
// This lets consumers group a <SplitPanel.Divider> with its trailing
// <SplitPanel.Panel> inside a Fragment without breaking panel counting or
// sized-pane detection.
function flattenChildren(children: React.ReactNode): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  Children.forEach(children, (child: React.ReactNode) => {
    if (isFragmentElement(child)) {
      out.push(...flattenChildren(child.props.children));
    } else {
      out.push(child);
    }
  });
  return out;
}

// Find the sized pane's sizing props AND wrap each Panel child with
// IsSizedPanelContext so it knows whether to render sized or fill.
function buildSplitPanelTree(children: React.ReactNode): {
  panelCount: number;
  sizedCount: number;
  sizedProps: SplitPanelPanelProps | null;
  wrappedChildren: React.ReactNode[] | null | undefined;
} {
  const flatChildren = flattenChildren(children);

  // Count panels up front. A panel is only treated as sized when there's a
  // second pane to absorb the remaining space; with a single panel it always
  // fills the container regardless of its `defaultSize`.
  let panelCount = 0;
  let sizedCount = 0;
  for (const child of flatChildren) {
    if (isPanelElement(child)) {
      panelCount++;
      if (child.props.defaultSize !== undefined) {
        sizedCount++;
      }
    }
  }
  const canSize = panelCount >= 2;

  let sized: SplitPanelPanelProps | null = null;
  const wrappedChildren = Children.map(flatChildren, child => {
    if (!isPanelElement(child)) {
      return child;
    }
    const isThisPanelSized =
      canSize && sized === null && child.props.defaultSize !== undefined;
    if (isThisPanelSized) {
      sized = child.props;
    }
    return (
      <IsSizedPanelContext.Provider value={isThisPanelSized}>
        {child}
      </IsSizedPanelContext.Provider>
    );
  });
  return {sizedProps: sized, wrappedChildren, panelCount, sizedCount};
}

function Root({
  children,
  orientation = 'horizontal',
  onMouseDown,
  onResize,
  onResizeEnd,
}: SplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = useDimensions({elementRef: containerRef});
  const availableSize = orientation === 'horizontal' ? dims.width : dims.height;

  const {sizedProps, wrappedChildren, panelCount, sizedCount} =
    buildSplitPanelTree(children);

  if (process.env.NODE_ENV !== 'production') {
    if (panelCount > 2) {
      // eslint-disable-next-line no-console
      console.warn(
        `SplitPanel.Root accepts at most two <SplitPanel.Panel> children. ` +
          `Got ${panelCount}. Extras will render but the layout is undefined.`
      );
    }
    if (sizedCount > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        'SplitPanel.Root: only one <SplitPanel.Panel> may declare `defaultSize`. ' +
          'The first is used; subsequent sized panels are ignored.'
      );
    }
  }
  const min = sizedProps?.minSize ?? 0;
  const explicitMax = sizedProps?.maxSize ?? Number.POSITIVE_INFINITY;
  // Cap the sized pane at the container size so it can never overflow the
  // parent. Until we've measured, fall back to the explicit max (or
  // Infinity) so the hook can accept the initial size without clamping it
  // to zero.
  const max = availableSize > 0 ? Math.min(explicitMax, availableSize) : explicitMax;
  const initialSize = sizedProps?.defaultSize ?? 0;

  const {
    isHeld,
    onDoubleClick,
    onMouseDown: onDragStart,
    setSize,
    size: containerSize,
  } = useResizableDrawer({
    direction: orientation === 'horizontal' ? 'left' : 'down',
    initialSize,
    min,
    max,
    onResize: newSize => onResize?.(newSize),
    onResizeEnd: ({startSize, endSize}) =>
      onResizeEnd?.({
        startSize,
        endSize,
        direction: endSize > startSize ? 'increase' : 'decrease',
      }),
  });

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onMouseDown?.(containerSize);
      onDragStart(event);
    },
    [onDragStart, containerSize, onMouseDown]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? 50 : 10;
      const isHorizontal = orientation === 'horizontal';
      const decreaseKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
      const increaseKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

      let newSize: number | null = null;
      if (event.key === decreaseKey) {
        newSize = Math.max(min, containerSize - step);
      } else if (event.key === increaseKey) {
        newSize = Math.min(max, containerSize + step);
      } else if (event.key === 'Home') {
        newSize = min;
      } else if (event.key === 'End' && Number.isFinite(max)) {
        newSize = max;
      }

      if (newSize !== null) {
        event.preventDefault();
        setSize(newSize, true);
        // Drag end is the only signal some consumers use to persist or track
        // the size; emit it for keyboard resizes too so they aren't lost.
        onResizeEnd?.({
          startSize: containerSize,
          endSize: newSize,
          direction: newSize > containerSize ? 'increase' : 'decrease',
        });
      }
    },
    [orientation, containerSize, min, max, setSize, onResizeEnd]
  );

  const contextValue = useMemo<SplitPanelContextValue>(
    () => ({
      isHeld,
      max,
      min,
      onDoubleClick,
      onKeyDown: handleKeyDown,
      onMouseDown: handleMouseDown,
      orientation,
      size: containerSize,
    }),
    [
      containerSize,
      handleKeyDown,
      handleMouseDown,
      isHeld,
      max,
      min,
      onDoubleClick,
      orientation,
    ]
  );

  return (
    <SplitPanelContext.Provider value={contextValue}>
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
            // Hide until the container has been measured. Avoids a brief
            // layout flash where the fill pane briefly takes 100% width.
            style={availableSize > 0 ? undefined : {visibility: 'hidden'}}
          >
            {wrappedChildren}
          </RootElement>
        )}
      </Flex>
    </SplitPanelContext.Provider>
  );
}

export const SplitPanel = {
  Root,
  Panel,
  Divider,
};

const RootElement = styled('div')`
  /*
   * Disable iframe pointer events while dragging so the divider doesn't lose
   * the cursor when crossing an embedded iframe (e.g. the Replay player).
   *
   * The triple-& is deliberate: it raises specificity so this reliably beats
   * the Replay player's [data-inspectable] .replayer-wrapper > iframe rule
   * (which re-enables pointer events with !important). At equal specificity the
   * two tie and the winner depends on stylesheet injection order, which made
   * the drag intermittently stick when the cursor crossed the video.
   */
  &&&[data-is-held='true'] iframe {
    pointer-events: none !important;
  }
`;

const DividerLine = styled('div')`
  user-select: none;

  /* Invisible wider hit area for dragging */
  &::before {
    content: '';
    position: absolute;
    z-index: 1;
  }

  &[data-orientation='horizontal'] {
    width: 0;
    height: 100%;
    cursor: ew-resize;
    border-left: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: 0 auto 0 -5px;
      width: 11px;
    }

    &:hover,
    &[data-is-held='true'] {
      border-left-color: ${p => p.theme.tokens.border.accent.moderate};
    }
  }

  &[data-orientation='vertical'] {
    width: 100%;
    height: 0;
    cursor: ns-resize;
    border-top: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: -5px 0 auto 0;
      height: 11px;
    }

    &:hover,
    &[data-is-held='true'] {
      border-top-color: ${p => p.theme.tokens.border.accent.moderate};
    }
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
