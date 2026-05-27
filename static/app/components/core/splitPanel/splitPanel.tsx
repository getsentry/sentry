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

import {IconGrabbable} from 'sentry/icons';
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

/**
 * Returns everything needed to render a custom divider element. Spread
 * `props` on the divider's root element to get ARIA, event handlers, and
 * `tabIndex`. Use `isHeld` and `orientation` for styling.
 */
export function useSplitPanelDivider() {
  const {isHeld, max, min, onDoubleClick, onKeyDown, onMouseDown, orientation, size} =
    useSplitPanelContext('useSplitPanelDivider');
  return {
    isHeld,
    orientation,
    props: {
      'aria-orientation':
        orientation === 'horizontal' ? ('vertical' as const) : ('horizontal' as const),
      'aria-valuemax': Number.isFinite(max) ? max : undefined,
      'aria-valuemin': min,
      'aria-valuenow': size,
      onDoubleClick,
      onKeyDown,
      onMouseDown,
      role: 'separator' as const,
      tabIndex: 0,
    },
  };
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
   * Fires as the user drags. Receives the new size in pixels.
   */
  onResize?: (newSize: number) => void;
  /**
   * Layout direction. `horizontal` splits left/right; `vertical` splits
   * top/bottom.
   */
  orientation?: Orientation;
  /**
   * Persist the user's drag size in `localStorage` under this key so it
   * survives reloads.
   */
  sizeStorageKey?: string;
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

export type SplitPanelDividerProps = {
  /**
   * Replace the default grab icon. The divider element itself (ARIA roles,
   * keyboard handlers, hit area) is unchanged.
   */
  icon?: React.ReactNode;
};

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

function Divider({icon}: SplitPanelDividerProps) {
  const {isHeld, max, min, onDoubleClick, onKeyDown, onMouseDown, orientation, size} =
    useSplitPanelContext('SplitPanel.Divider');

  return (
    <DividerHandle
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
    >
      {icon ?? <IconGrabbable size="sm" />}
    </DividerHandle>
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
  sizeStorageKey,
  onMouseDown,
  onResize,
}: SplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = useDimensions({elementRef: containerRef});
  const availableSize = orientation === 'horizontal' ? dims.width : dims.height;

  const sizedProps = useMemo(() => findSizedPanelProps(children), [children]);
  const min = sizedProps?.minSize ?? 0;
  const max = sizedProps?.maxSize ?? Number.POSITIVE_INFINITY;
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
    onResize: onResize ?? (() => {}),
    sizeStorageKey,
  });

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

  // Tag each Panel child with whether it's the sized one. We can't read the
  // tag inside Panel without an extra Context, so this drives IsSizedPanelContext.
  let sizedPanelMarked = false;
  const wrappedChildren = Children.map(children, child => {
    if (isValidElement(child) && child.type === Panel) {
      const childProps = child.props as SplitPanelPanelProps;
      const isThisPanelSized = !sizedPanelMarked && childProps.defaultSize !== undefined;
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
   */
  &&.disable-iframe-pointer iframe {
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

const DividerHandle = styled('div')`
  display: grid;
  place-items: center;
  flex-shrink: 0;
  user-select: inherit;
  background: inherit;

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: -2px;
  }
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  &[data-is-held='true'] {
    user-select: none;
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  &[data-orientation='horizontal'] {
    cursor: ew-resize;
    height: 100%;
    width: ${p => p.theme.space.xl};
  }
  &[data-orientation='vertical'] {
    cursor: ns-resize;
    width: 100%;
    height: ${p => p.theme.space.xl};

    & > svg {
      transform: rotate(90deg);
    }
  }
`;
