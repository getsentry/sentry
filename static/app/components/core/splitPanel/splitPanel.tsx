import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import styled from '@emotion/styled';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

type Orientation = 'horizontal' | 'vertical';

type SplitPanelContextValue = {
  isHeld: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
  isReady: boolean;
  max: number;
  maximiseSize: () => void;
  min: number;
  minimiseSize: () => void;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  orientation: Orientation;
  resetSize: () => void;
  size: number;
};

const SplitPanelContext = createContext<SplitPanelContextValue | null>(null);

function useSplitPanelContext(component: string): SplitPanelContextValue {
  const ctx = useContext(SplitPanelContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <SplitPanel>`);
  }
  return ctx;
}

/**
 * Imperative controls for the surrounding `<SplitPanel>`. Use from any
 * descendant to programmatically maximise, minimise, or reset the sized pane.
 */
export function useSplitPanel() {
  const {isMaximized, isMinimized, maximiseSize, minimiseSize, resetSize} =
    useSplitPanelContext('useSplitPanel');
  return {isMaximized, isMinimized, maximiseSize, minimiseSize, resetSize};
}

export type SplitPanelProps = {
  /**
   * Exactly one `<SplitPanel.Panel>` followed by an optional
   * `<SplitPanel.Divider>` and a second `<SplitPanel.Panel>`. When only one
   * `<SplitPanel.Panel>` is rendered, it fills the container.
   */
  children: React.ReactNode;
  /**
   * Fires when the user starts dragging the divider. Receives the current
   * size of the sized pane as a percentage of the container.
   */
  onMouseDown?: (sizePct: `${number}%`) => void;
  /**
   * Fires as the user drags. Receives the new size in pixels. Wire this to
   * your own persistence layer if you want to remember the size across
   * reloads (e.g. `useLocalStorageState`).
   */
  onResize?: (newSize: number) => void;
  /**
   * Layout direction. `horizontal` splits left/right; `vertical` splits
   * top/bottom.
   */
  orientation?: Orientation;
};

export type SplitPanelPanelProps = {
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

export type SplitPanelDividerProps = Record<string, never>;

function Panel({children}: SplitPanelPanelProps) {
  const {isReady, orientation, size} = useSplitPanelContext('SplitPanel.Panel');
  const isSized = useIsSizedPanel();

  return (
    <PanelContainer
      data-orientation={orientation}
      data-sized={isSized || undefined}
      sizePx={isSized ? size : undefined}
      // Hide the sized pane until we've measured the container. Avoids a
      // pre-measurement layout flash where the pane briefly takes 0px.
      style={isSized && !isReady ? {visibility: 'hidden'} : undefined}
    >
      {children}
    </PanelContainer>
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
    <DividerLine
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
  );
}

function findSizedPanelProps(children: React.ReactNode): SplitPanelPanelProps | null {
  let result: SplitPanelPanelProps | null = null;
  Children.forEach(children, child => {
    if (result) {
      return;
    }
    if (isValidElement(child) && child.type === Panel) {
      const props = child.props as SplitPanelPanelProps;
      if (props.defaultSize !== undefined) {
        result = props;
      }
    }
  });
  return result;
}

export function SplitPanel({
  children,
  orientation = 'horizontal',
  onMouseDown,
  onResize,
}: SplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = useDimensions({elementRef: containerRef});
  const availableSize = orientation === 'horizontal' ? dims.width : dims.height;

  const sizedProps = useMemo(() => findSizedPanelProps(children), [children]);
  const min = sizedProps?.minSize ?? 0;
  const explicitMax = sizedProps?.maxSize ?? Number.POSITIVE_INFINITY;
  // Cap the sized pane at the container size so it can never overflow the
  // parent. Matches Zag/Chakra's `maxSize = 100%` default. Until we've
  // measured, fall back to the explicit max (or Infinity) so the hook can
  // accept the initial size without clamping it to zero.
  const max = availableSize > 0 ? Math.min(explicitMax, availableSize) : explicitMax;
  const initialSize = sizedProps?.defaultSize ?? 0;

  // useResizableDrawer only enforces `min`, not `max`, so its internal size can
  // drift past `max` while the user keeps dragging. We clamp before forwarding
  // to the consumer's `onResize` and snap the hook back when it drifts, so
  // dragging in the opposite direction responds immediately.
  const setSizeRef = useRef<(size: number, userEvent?: boolean) => void>(() => {});
  const handleHookResize = useCallback(
    (newSize: number) => {
      const clamped = Math.min(Math.max(newSize, min), max);
      if (clamped !== newSize) {
        setSizeRef.current(clamped, true);
        return;
      }
      onResize?.(newSize);
    },
    [onResize, min, max]
  );

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
    onResize: handleHookResize,
  });
  setSizeRef.current = setSize;

  const clampedSize = Math.min(containerSize, max);
  const sizePct = `${
    availableSize > 0 ? (clampedSize / availableSize) * 100 : 0
  }%` as const;

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onMouseDown?.(sizePct);
      onDragStart(event);
    },
    [onDragStart, sizePct, onMouseDown]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? 50 : 10;
      const isHorizontal = orientation === 'horizontal';
      const decreaseKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
      const increaseKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

      if (event.key === decreaseKey) {
        event.preventDefault();
        setSize(Math.max(min, containerSize - step), true);
      } else if (event.key === increaseKey) {
        event.preventDefault();
        setSize(Math.min(max, containerSize + step), true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setSize(min, true);
      } else if (event.key === 'End' && Number.isFinite(max)) {
        event.preventDefault();
        setSize(max, true);
      }
    },
    [orientation, containerSize, min, max, setSize]
  );

  const isReady = availableSize > 0;
  const isMaximized = containerSize >= max;
  const isMinimized = containerSize <= min;

  const contextValue = useMemo<SplitPanelContextValue>(
    () => ({
      isHeld,
      isMaximized,
      isMinimized,
      isReady,
      max,
      maximiseSize: () => setSize(max),
      min,
      minimiseSize: () => setSize(min),
      onDoubleClick,
      onKeyDown: handleKeyDown,
      onMouseDown: handleMouseDown,
      orientation,
      resetSize: () => setSize(initialSize),
      size: isReady ? clampedSize : 0,
    }),
    [
      clampedSize,
      handleKeyDown,
      handleMouseDown,
      initialSize,
      isHeld,
      isMaximized,
      isMinimized,
      isReady,
      max,
      min,
      onDoubleClick,
      orientation,
      setSize,
    ]
  );

  // Count Panel children so a lone Panel fills the container regardless of
  // its sizing props. Lets a consumer collapse the second panel (drop the
  // divider + second `<SplitPanel.Panel>`) and have the first expand to fill.
  let panelCount = 0;
  Children.forEach(children, child => {
    if (isValidElement(child) && child.type === Panel) {
      panelCount++;
    }
  });

  // Tag each Panel child with whether it's the sized one. We can't read the
  // tag inside Panel without an extra Context, so this drives IsSizedPanelContext.
  let sizedPanelMarked = false;
  const wrappedChildren = Children.map(children, child => {
    if (isValidElement(child) && child.type === Panel) {
      const childProps = child.props as SplitPanelPanelProps;
      const isThisPanelSized =
        panelCount > 1 && !sizedPanelMarked && childProps.defaultSize !== undefined;
      if (isThisPanelSized) {
        sizedPanelMarked = true;
      }
      return (
        <IsSizedPanelContext.Provider value={isThisPanelSized}>
          {child}
        </IsSizedPanelContext.Provider>
      );
    }
    return child;
  });

  return (
    <SplitPanelContext.Provider value={contextValue}>
      <SplitPanelRoot
        ref={containerRef}
        className={isHeld ? 'disable-iframe-pointer' : undefined}
        data-orientation={orientation}
      >
        {wrappedChildren}
      </SplitPanelRoot>
    </SplitPanelContext.Provider>
  );
}

SplitPanel.Panel = Panel;
SplitPanel.Divider = Divider;

const SplitPanelRoot = styled('div')`
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  flex-grow: 1;

  &[data-orientation='horizontal'] {
    flex-direction: row;
  }
  &[data-orientation='vertical'] {
    flex-direction: column;
  }

  /*
   * Disable iframe pointer events while dragging so the divider doesn't lose
   * the cursor when crossing an embedded iframe (e.g. the Replay player).
   *
   * The triple-& is deliberate: it raises specificity so this reliably beats
   * consumer rules that re-enable iframe pointer events with !important -- e.g.
   * the Replay player's [data-inspectable] .replayer-wrapper iframe rule, which
   * otherwise ties on specificity and wins by injection order, making the drag
   * intermittently stick when the cursor crosses the video.
   */
  &&&.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;

const PanelContainer = styled('div')<{sizePx: number | undefined}>`
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  ${p => (p.sizePx === undefined ? 'flex: 1 1 0;' : `flex: 0 0 ${p.sizePx}px;`)}
`;

const DividerLine = styled('div')`
  position: relative;
  flex-shrink: 0;
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
      top: 0;
      bottom: 0;
      left: -5px;
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
      left: 0;
      right: 0;
      top: -5px;
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
