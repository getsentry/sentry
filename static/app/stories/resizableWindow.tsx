import {
  type Ref,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {useStableMergeRef} from 'sentry/utils/useStableMergeRef';

const MIN_WIDTH = 100;
const MIN_HEIGHT = 60;

type Edge = 'right' | 'bottom' | 'corner';

interface ResizableWindowProps {
  children?: ReactNode;
  className?: string;
  onResize?: (size: {height: number; width: number}) => void;
  ref?: Ref<HTMLDivElement>;
}

export function ResizableWindow({
  children,
  className,
  onResize,
  ref,
}: ResizableWindowProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const getMergedRef = useStableMergeRef(innerRef);
  const {handlePointerDown, dragging} = useDragResize(innerRef, onResize);

  return (
    <WindowRoot
      containerType="inline-size"
      ref={getMergedRef(ref)}
      className={className}
      data-dragging={dragging || undefined}
      data-edge={dragging || undefined}
      border="primary"
      background="secondary"
    >
      <Handle data-edge="right" onPointerDown={e => handlePointerDown(e, 'right')} />
      <Handle data-edge="bottom" onPointerDown={e => handlePointerDown(e, 'bottom')} />
      <Handle data-edge="corner" onPointerDown={e => handlePointerDown(e, 'corner')} />
      <Container height="inherit" flex="1" overflow="hidden" style={{marginTop: -2}}>
        {children}
      </Container>
    </WindowRoot>
  );
}

export function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const sizeRef = useRef({width: 0, height: 0});

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const el = ref.current;
      if (!el) {
        return () => {};
      }
      const ro = new ResizeObserver(entries => {
        const rect = entries[0]?.contentRect;
        if (!rect) {
          return;
        }
        if (
          rect.width !== sizeRef.current.width ||
          rect.height !== sizeRef.current.height
        ) {
          sizeRef.current = {width: rect.width, height: rect.height};
          onStoreChange();
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    },
    [ref]
  );

  return useSyncExternalStore(
    subscribe,
    () => sizeRef.current,
    () => ({width: 0, height: 0})
  );
}

function useDragResize(
  containerRef: React.RefObject<HTMLElement | null>,
  onResize?: (size: {height: number; width: number}) => void
) {
  const [dragging, setDragging] = useState<Edge | false>(false);
  const dragState = useRef<{
    edge: Edge;
    startH: number;
    startW: number;
    startX: number;
    startY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, edge: Edge) => {
      const el = containerRef.current;
      if (!el) {
        return;
      }
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      dragState.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
      };
      setDragging(edge);
    },
    [containerRef]
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      const el = containerRef.current;
      const state = dragState.current;
      if (!el || !state) {
        return;
      }
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (state.edge === 'right' || state.edge === 'corner') {
        el.style.width = `${Math.max(MIN_WIDTH, state.startW + dx)}px`;
      }
      if (state.edge === 'bottom' || state.edge === 'corner') {
        el.style.height = `${Math.max(MIN_HEIGHT, state.startH + dy)}px`;
      }
      onResize?.({width: el.offsetWidth, height: el.offsetHeight});
    };

    const onPointerUp = () => {
      dragState.current = null;
      setDragging(false);
      document.body.style.cursor = '';
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, containerRef, onResize]);

  return {handlePointerDown, dragging};
}

const WindowRoot = styled(Container)`
  position: relative;
  width: 100%;
  max-width: 100%;

  &[data-dragging] {
    user-select: none;
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    border-color: ${p => p.theme.tokens.graphics.neutral.moderate};
  }
`;

const Handle = styled('div')`
  position: absolute;
  touch-action: none;
  --color: ${p => p.theme.tokens.border.primary};
  --hit: 24px;
  --sw: 1px;
  --offset: calc(var(--hit) / 2 - var(--sw) / 2);

  &::after {
    content: '';
    position: absolute;
    background: var(--color);
  }

  &:hover,
  ${WindowRoot}:has(> [data-edge='corner']:hover) > & {
    --sw: 1px;
    --color: ${p => p.theme.tokens.graphics.neutral.vibrant};
  }

  &[data-edge='right'] {
    top: 0;
    right: calc(var(--hit) / -2);
    width: var(--hit);
    bottom: calc(var(--sw)*-0.5);
    cursor: ew-resize;

    &::after {
      top: 0;
      bottom: 0;
      left: var(--offset);
      width: var(--sw);
    }
  }

  &[data-edge='bottom'] {
    bottom: calc(var(--hit) / -2);
    left: 0;
    height: var(--hit);
    right: var(--sw);
    cursor: ns-resize;

    &::after {
      left: 0;
      right: calc(var(--sw) * -1);
      top: var(--offset);
      height: var(--sw);
    }
  }

  &[data-edge='corner'] {
    bottom: 0;
    right: 0;
    width: var(--hit);
    height: var(--hit);
    cursor: nwse-resize;

    &::after {
      --grip: 24px;
      --a: calc(var(--grip) / 3);
      --b: calc(var(--a) / 2);
      bottom: 2px;
      right: 2px;
      width: var(--grip);
      height: var(--grip);
      background: linear-gradient(
        -45deg,
        transparent calc(var(--b) - var(--sw) / 2),
        var(--color) calc(var(--b) - var(--sw) / 2),
        var(--color) calc(var(--b) + var(--sw) / 2),
        transparent calc(var(--b) + var(--sw) / 2),
        transparent calc(var(--a) - var(--sw) / 2),
        var(--color) calc(var(--a) - var(--sw) / 2),
        var(--color) calc(var(--a) + var(--sw) / 2),
        transparent calc(var(--a) + var(--sw) / 2)
      );
    }
  }

  ${WindowRoot}[data-edge='corner'] > &[data-edge='corner'] {
    --sw: 2px;
    --color: ${p => p.theme.tokens.border.accent.vibrant};
    z-index: 2;
  }

  /* Active: 4px on dragged edges */
  ${WindowRoot}[data-edge='right'] > &[data-edge='right'],
  ${WindowRoot}[data-edge='corner'] > &[data-edge='right'],
  ${WindowRoot}[data-edge='bottom'] > &[data-edge='bottom'],
  ${WindowRoot}[data-edge='corner'] > &[data-edge='bottom'] {
    --sw: 4px;
    --color: ${p => p.theme.tokens.border.accent.vibrant};
    z-index: 1;
  }
`;
