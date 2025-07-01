import type {RefObject} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

const RESIZABLE_DEFAULT_WIDTH = 200;
const RESIZABLE_MIN_WIDTH = 100;
const RESIZABLE_MAX_WIDTH = Infinity;

interface UseResizableOptions {
  /**
   * The ref to the element to be resized.
   */
  ref: RefObject<HTMLElement | null>;

  /**
   * The starting size of the container, and the size that is set in the onDoubleClick handler.
   *
   * If `sizeStorageKey` is provided and exists in local storage,
   * then this will be ignored in favor of the size stored in local storage.
   */
  initialSize?: number;

  /**
   * The maximum width the container can be resized to. Defaults to Infinity.
   */
  maxWidth?: number;

  /**
   * The minimum width the container can be resized to. Defaults to 100.
   */
  minWidth?: number;

  /**
   * Triggered when the user finishes dragging the resize handle.
   */
  onResizeEnd?: (newWidth: number) => void;

  /**
   * Triggered when the user starts dragging the resize handle.
   */
  onResizeStart?: () => void;
}

/**
 * Performant hook to support draggable container resizing.
 *
 * Currently only supports resizing width and not height.
 */
const useResizable = ({
  ref,
  initialSize = RESIZABLE_DEFAULT_WIDTH,
  maxWidth = RESIZABLE_MAX_WIDTH,
  minWidth = RESIZABLE_MIN_WIDTH,
  onResizeEnd,
  onResizeStart,
}: UseResizableOptions): {
  /**
   * Whether the drag handle is held.
   */
  isHeld: boolean;
  /**
   * Apply this to the drag handle element to include 'reset' functionality.
   */
  onDoubleClick: () => void;
  /**
   * Attach this to the drag handle element's onMouseDown handler.
   */
  onMouseDown: (e: React.MouseEvent) => void;
  /**
   * The current size of the container. This is NOT updated during the drag
   * event, only after the user finishes dragging.
   */
  size: number;
} => {
  const [isHeld, setIsHeld] = useState(false);

  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.width = `${initialSize}px`;
    }
  }, [ref, initialSize]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsHeld(true);
      e.preventDefault();

      const currentWidth = ref.current
        ? parseInt(getComputedStyle(ref.current).width, 10)
        : 0;

      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;

      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      onResizeStart?.();
    },
    [ref, onResizeStart]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + deltaX)
      );

      if (ref.current) {
        ref.current.style.width = `${newWidth}px`;
      }
    },
    [ref, minWidth, maxWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsHeld(false);
    const newSize = ref.current?.offsetWidth ?? initialSize;
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onResizeEnd?.(newSize);
  }, [onResizeEnd, ref, initialSize]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const onDoubleClick = useCallback(() => {
    if (ref.current) {
      ref.current.style.width = `${initialSize}px`;
    }
  }, [ref, initialSize]);

  return {
    isHeld,
    size: ref.current?.offsetWidth ?? initialSize,
    onMouseDown: handleMouseDown,
    onDoubleClick,
  };
};

export default useResizable;
