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
  onResize: (newSize: number, maybeOldSize?: number) => void;
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
   * Apply this to include 'reset' functionality on the drag handle
   */
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  /**
   * Apply to the drag handle element
   */
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  /**
   * The resulting size of the container axis. Updated while dragging.
   *
   * NOTE: Be careful using this as this as react state updates are not
   * synchronous, you may want to update the element size using onResize instead
   */
  size: number;
} {
  const rafIdRef = useRef<number | null>(null);
  const currentMouseVectorRaf = useRef<[number, number] | null>(null);
  const [size, setSize] = useState<number>(options.initialSize ?? 0);
  const [isHeld, setIsHeld] = useState(false);

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  useLayoutEffect(() => {
    options.onResize(options.initialSize ?? 0, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);

  const sizeRef = useRef<number>(size);
  sizeRef.current = size;

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      // these read from options, they're constant inside the mousemove event:
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

        // why store both? just store the one we care about
        const newPositionVector: [number, number] = [event.clientX, event.clientY];
        const newAxisPosition = isXAxis ? newPositionVector[0] : newPositionVector[1];

        // if we store one, then no need for this condition:
        const currentAxisPosition = isXAxis
          ? currentMouseVectorRaf.current[0]
          : currentMouseVectorRaf.current[1];

        const positionDelta = currentAxisPosition - newAxisPosition;

        currentMouseVectorRaf.current = newPositionVector;

        // Round to 1px precision
        const newSize = Math.round(
          Math.max(options.min, sizeRef.current + positionDelta * (isInverted ? -1 : 1))
        );

        options.onResize(newSize);
        setSize(newSize);
      });
    },
    [options]
  );

  const onMouseUp = useCallback(() => {
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
      // just store the one we care about:
      currentMouseVectorRaf.current = [evt.clientX, evt.clientY];

      document.addEventListener('mousemove', onMouseMove, {passive: true});
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  const onDoubleClick = useCallback(() => {
    setSize(options.initialSize);
    options.onResize(options.initialSize);
  }, [options]);

  useLayoutEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  });

  return {size, isHeld, onMouseDown, onDoubleClick};
}
