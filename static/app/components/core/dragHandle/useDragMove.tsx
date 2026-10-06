import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useMove} from '@react-aria/interactions';

import {setDocumentDragging} from 'sentry/utils/setDocumentDragging';

import type {Orientation} from './dragHandle';

const KEYBOARD_STEP = 10;

const KEYBOARD_STEP_LARGE = 50;

const AXIS_KEYS: Record<Orientation, Set<string>> = {
  horizontal: new Set(['ArrowLeft', 'ArrowRight', 'Left', 'Right']),
  vertical: new Set(['ArrowUp', 'ArrowDown', 'Up', 'Down']),
};

interface UseDragMoveOptions {
  onMove: (delta: number) => void;
  orientation: Orientation;
  onMoveEnd?: () => void;
  onMoveStart?: () => void;
}

export function useDragMove({
  onMove,
  onMoveEnd,
  onMoveStart,
  orientation,
}: UseDragMoveOptions) {
  const [isHeld, setIsHeld] = useState(false);
  const isPointerDragRef = useRef(false);

  const stopDocumentDragging = useCallback(() => {
    if (isPointerDragRef.current) {
      isPointerDragRef.current = false;
      setDocumentDragging(null);
    }
  }, []);

  useEffect(() => stopDocumentDragging, [stopDocumentDragging]);

  const {moveProps} = useMove({
    onMoveStart: event => {
      setIsHeld(true);

      if (event.pointerType !== 'keyboard') {
        isPointerDragRef.current = true;
        setDocumentDragging(orientation === 'horizontal' ? 'ew-resize' : 'ns-resize');
      }

      onMoveStart?.();
    },
    onMove: event => {
      const delta = orientation === 'horizontal' ? event.deltaX : event.deltaY;

      if (!delta) {
        return;
      }

      onMove(
        event.pointerType === 'keyboard'
          ? Math.sign(delta) * (event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP)
          : delta
      );
    },
    onMoveEnd: () => {
      setIsHeld(false);
      stopDocumentDragging();
      onMoveEnd?.();
    },
  });

  // useMove counts a key across the axis as a move, so it would start and end a move
  // this hook then drops, leaving a consumer to commit a size that never changed.
  const axisMoveProps = useMemo(
    () => ({
      ...moveProps,
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (AXIS_KEYS[orientation].has(event.key)) {
          moveProps.onKeyDown?.(event);
        }
      },
    }),
    [moveProps, orientation]
  );

  return {isHeld, moveProps: axisMoveProps};
}
