import {useCallback, useLayoutEffect, useRef, useState} from 'react';

export interface UseResizableDrawerOptions {
  /**
   * When dragging, which direction should be used for the delta
   */
  direction: 'right' | 'left' | 'down' | 'up';
  /**
   * The starting size of the container
   */
  initialSize: number;
  /**
   * The minimum sizes the container may be dragged to
   */
  min: number;
  /**
   * Triggered while dragging
   */
  onResize: (size: number, userEvent: boolean) => void;
  /**
   * The local storage key used to persist the size of the container
   */
  sizeStorageKey?: string;
}

/**
 * Hook to support draggable container resizing
 *
 * This only resizes one dimension at a time.
 */
export function useResizableDrawer(options: UseResizableDrawerOptions): {
  /**
   * Indicates the drag handle is held. Useful to apply a styled to your handle
   * that will not be removed if the mouse moves outside of the hitbox of your
   * handle.
   */
  isHeld: boolean;
  /**
   * Apply to the drag handle element
   */
  onMouseDown: React.MouseEventHandler<HTMLElement>;
} {
  const rafIdRef = useRef<number | null>(null);
  const currentMouseVectorRaf = useRef<[number, number] | null>(null);
  const [isHeld, setIsHeld] = useState(false);
  const sizeRef = useRef<number>(options.initialSize);

  const updateSize = useCallback(
    (newSize: number, userEvent = false) => {
      sizeRef.current = newSize;
      options.onResize(newSize, userEvent);
    },
    [options]
  );

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  useLayoutEffect(() => {
    sizeRef.current = options.initialSize;
    options.onResize(options.initialSize ?? 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      const isXAxis = options.direction === 'left' || options.direction === 'right';
      const isInverted = options.direction === 'down' || options.direction === 'left';

      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';

      // We've disabled pointerEvents on the body, the cursor needs to be
      // applied to the root most element to work
      document.documentElement.style.cursor = isXAxis ? 'ew-resize' : 'ns-resize';

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!currentMouseVectorRaf.current) {
          return;
        }

        const newPositionVector: [number, number] = [event.clientX, event.clientY];
        const newAxisPosition = isXAxis ? newPositionVector[0] : newPositionVector[1];

        const currentAxisPosition = isXAxis
          ? currentMouseVectorRaf.current[0]
          : currentMouseVectorRaf.current[1];

        const positionDelta = currentAxisPosition - newAxisPosition;

        currentMouseVectorRaf.current = newPositionVector;

        // Round to 1px precision
        const newSize = Math.round(
          Math.max(options.min, sizeRef.current + positionDelta * (isInverted ? -1 : 1))
        );

        updateSize(newSize, true);
      });
    },
    [options.direction, options.min, updateSize]
  );

  const onMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    setIsHeld(false);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      setIsHeld(true);
      currentMouseVectorRaf.current = [evt.clientX, evt.clientY];

      document.addEventListener('mousemove', onMouseMove, {passive: true});
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  return {isHeld, onMouseDown};
}
