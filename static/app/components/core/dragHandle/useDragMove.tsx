import {useCallback, useEffect, useRef, useState} from 'react';
import {useMove} from '@react-aria/interactions';

import type {Orientation} from './dragHandle';

const KEYBOARD_STEP = 10;

const KEYBOARD_STEP_LARGE = 50;

interface UseDragMoveOptions {
  onMove: (delta: number) => void;
  orientation: Orientation;
  largeStep?: number;
  onMoveEnd?: () => void;
  onMoveStart?: () => void;
  step?: number;
}

function setDocumentDragging(isDragging: boolean, cursor: string) {
  document.body.style.pointerEvents = isDragging ? 'none' : '';
  document.body.style.userSelect = isDragging ? 'none' : '';
  document.documentElement.style.cursor = isDragging ? cursor : '';
}

export function useDragMove({
  largeStep = KEYBOARD_STEP_LARGE,
  onMove,
  onMoveEnd,
  onMoveStart,
  orientation,
  step = KEYBOARD_STEP,
}: UseDragMoveOptions) {
  const [isHeld, setIsHeld] = useState(false);
  const isPointerDragRef = useRef(false);

  const stopDocumentDragging = useCallback(() => {
    if (isPointerDragRef.current) {
      isPointerDragRef.current = false;
      setDocumentDragging(false, '');
    }
  }, []);

  useEffect(() => stopDocumentDragging, [stopDocumentDragging]);

  const {moveProps} = useMove({
    onMoveStart: event => {
      setIsHeld(true);

      if (event.pointerType !== 'keyboard') {
        isPointerDragRef.current = true;
        setDocumentDragging(
          true,
          orientation === 'horizontal' ? 'ew-resize' : 'ns-resize'
        );
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
          ? Math.sign(delta) * (event.shiftKey ? largeStep : step)
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
