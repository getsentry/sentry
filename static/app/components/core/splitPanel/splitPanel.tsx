import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';

type Orientation = 'horizontal' | 'vertical';
type PanelRole = 'lone' | 'sized' | 'fill';

type SplitPanelContextValue = {
  isHeld: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
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
const PanelRoleContext = createContext<PanelRole>('lone');

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
   * size of the sized pane as a percentage (0-100).
   */
  onMouseDown?: (sizePct: number) => void;
  /**
   * Fires as the user drags. Receives the new size as a percentage (0-100).
   * Wire this to your own persistence layer if you want to remember the size
   * across reloads (e.g. `useLocalStorageState`).
   */
  onResize?: (sizePct: number) => void;
  /**
   * Layout direction. `horizontal` splits left/right; `vertical` splits
   * top/bottom.
   */
  orientation?: Orientation;
};

export type SplitPanelPanelProps = {
  children: React.ReactNode;
  /**
   * Initial size of this pane as a percentage of the container (0-100). The
   * pane that declares `defaultSize` is the sized pane; the other fills the
   * remaining space. Only one pane may be sized.
   */
  defaultSize?: number;
  /**
   * Maximum size as a percentage (0-100). Only meaningful on the sized pane.
   * Defaults to 100.
   */
  maxSize?: number;
  /**
   * Minimum size as a percentage (0-100). Only meaningful on the sized pane.
   * Defaults to 0.
   */
  minSize?: number;
};

export type SplitPanelDividerProps = Record<string, never>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function Panel({children}: SplitPanelPanelProps) {
  const {orientation, size} = useSplitPanelContext('SplitPanel.Panel');
  const role = useContext(PanelRoleContext);
  // Both panes use flex-grow as a ratio; flexbox automatically distributes
  // (container - divider) proportionally. A lone pane just fills.
  const flexGrow = role === 'lone' ? 1 : role === 'sized' ? size : 100 - size;

  return (
    <PanelContainer
      data-orientation={orientation}
      data-sized={role === 'sized' || undefined}
      style={{flexGrow}}
    >
      {children}
    </PanelContainer>
  );
}

function Divider() {
  const {isHeld, max, min, onDoubleClick, onKeyDown, onMouseDown, orientation, size} =
    useSplitPanelContext('SplitPanel.Divider');

  return (
    <DividerLine
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-valuemax={max}
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

  const sizedProps = useMemo(() => findSizedPanelProps(children), [children]);
  const min = sizedProps?.minSize ?? 0;
  const max = sizedProps?.maxSize ?? 100;
  const initialSize = clamp(sizedProps?.defaultSize ?? 50, min, max);

  const [size, setSize] = useState(initialSize);
  const [isHeld, setIsHeld] = useState(false);

  const updateSize = useCallback(
    (newSize: number) => {
      const clamped = clamp(newSize, min, max);
      setSize(clamped);
      onResize?.(clamped);
    },
    [min, max, onResize]
  );

  const draggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingRef.current) {
        return;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        const rect = container.getBoundingClientRect();
        const isHorizontal = orientation === 'horizontal';
        const total = isHorizontal ? rect.width : rect.height;
        if (total === 0) {
          return;
        }
        const offset = isHorizontal
          ? event.clientX - rect.left
          : event.clientY - rect.top;
        updateSize((offset / total) * 100);
      });
    },
    [orientation, updateSize]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    setIsHeld(false);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onMouseDown?.(size);
      draggingRef.current = true;
      setIsHeld(true);
      document.body.style.userSelect = 'none';
      document.documentElement.style.cursor =
        orientation === 'horizontal' ? 'ew-resize' : 'ns-resize';
      document.addEventListener('mousemove', handleMouseMove, {passive: true});
      document.addEventListener('mouseup', handleMouseUp);
      event.preventDefault();
    },
    [orientation, onMouseDown, size, handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const step = event.shiftKey ? 5 : 1;
      const isHorizontal = orientation === 'horizontal';
      const decreaseKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
      const increaseKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

      if (event.key === decreaseKey) {
        event.preventDefault();
        updateSize(size - step);
      } else if (event.key === increaseKey) {
        event.preventDefault();
        updateSize(size + step);
      } else if (event.key === 'Home') {
        event.preventDefault();
        updateSize(min);
      } else if (event.key === 'End') {
        event.preventDefault();
        updateSize(max);
      }
    },
    [orientation, size, min, max, updateSize]
  );

  const handleDoubleClick = useCallback(() => {
    updateSize(initialSize);
  }, [initialSize, updateSize]);

  const isMaximized = size >= max;
  const isMinimized = size <= min;

  const contextValue = useMemo<SplitPanelContextValue>(
    () => ({
      isHeld,
      isMaximized,
      isMinimized,
      max,
      maximiseSize: () => updateSize(max),
      min,
      minimiseSize: () => updateSize(min),
      onDoubleClick: handleDoubleClick,
      onKeyDown: handleKeyDown,
      onMouseDown: handleMouseDown,
      orientation,
      resetSize: () => updateSize(initialSize),
      size,
    }),
    [
      handleDoubleClick,
      handleKeyDown,
      handleMouseDown,
      initialSize,
      isHeld,
      isMaximized,
      isMinimized,
      max,
      min,
      orientation,
      size,
      updateSize,
    ]
  );

  let panelCount = 0;
  Children.forEach(children, child => {
    if (isValidElement(child) && child.type === Panel) {
      panelCount++;
    }
  });

  let sizedPanelMarked = false;
  const wrappedChildren = Children.map(children, child => {
    if (isValidElement(child) && child.type === Panel) {
      const childProps = child.props as SplitPanelPanelProps;
      let role: PanelRole;
      if (panelCount < 2) {
        role = 'lone';
      } else if (!sizedPanelMarked && childProps.defaultSize !== undefined) {
        role = 'sized';
        sizedPanelMarked = true;
      } else {
        role = 'fill';
      }
      return <PanelRoleContext.Provider value={role}>{child}</PanelRoleContext.Provider>;
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
   */
  &&.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;

const PanelContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  flex-shrink: 1;
  flex-basis: 0;
`;

const DividerLine = styled('div')`
  position: relative;
  flex-shrink: 0;
  flex-grow: 0;
  flex-basis: auto;
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
