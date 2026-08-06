import {useCallback, useEffect, useRef, useState} from 'react';
import {useMove} from '@react-aria/interactions';

import {setDocumentDragging} from 'sentry/utils/setDocumentDragging';

import type {Orientation} from './dragHandle';

const KEYBOARD_STEP = 10;

const KEYBOARD_STEP_LARGE = 50;

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

  return {isHeld, moveProps};
}
