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
  onResize: (
    newSize: number,
    maybeOldSize: number | undefined,
    userEvent: boolean
  ) => void;
  /**
   * The maximum size the container may be dragged to. Optional — defaults
   * to no upper bound. Only enforced during drag, mirroring `min`.
   */
  max?: number;
  /**
   * Fires once when a drag completes (on mouseUp). Receives the size at
   * the start and end of the drag.
   */
  onResizeEnd?: (sizes: {endSize: number; startSize: number}) => void;
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
   * Apply this to include 'reset' functionality on the drag handle
   */
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  /**
   * Apply to the drag handle element
   */
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  /**
   * Call this function to manually set the size of the drawer.
   */
  setSize: (newSize: number, userEvent?: boolean) => void;
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
  const [size, setSize] = useState<number>(() => {
    const storedSize = options.sizeStorageKey
      ? parseInt(localStorage.getItem(options.sizeStorageKey) ?? '', 10)
      : undefined;

    return storedSize || options.initialSize;
  });
  const [isHeld, setIsHeld] = useState(false);

  const updateSize = useCallback(
    (newSize: number, userEvent = false) => {
      sizeRef.current = newSize;
      setSize(newSize);
      options.onResize(newSize, undefined, userEvent);
      if (options.sizeStorageKey) {
        localStorage.setItem(options.sizeStorageKey, newSize.toString());
      }
    },
    [options]
  );

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  useLayoutEffect(() => {
    options.onResize(options.initialSize ?? 0, size, false);
    setSize(options.initialSize ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);

  const sizeRef = useRef(size);
  sizeRef.current = size;

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

        // Round to 1px precision. Clamp to [min, max].
        const newSize = Math.round(
          Math.min(
            options.max ?? Number.POSITIVE_INFINITY,
            Math.max(options.min, sizeRef.current + positionDelta * (isInverted ? -1 : 1))
          )
        );

        updateSize(newSize, true);
      });
    },
    [options.direction, options.min, options.max, updateSize]
  );

  const dragStartSizeRef = useRef<number | null>(null);
  // Track the exact listener instances attached on mousedown so the unmount
  // cleanup can detach them — their identities change across renders, so the
  // cleanup can't recreate them.
  const attachedListenersRef = useRef<{
    onMouseMove: (event: MouseEvent) => void;
    onMouseUp: () => void;
  } | null>(null);

  const onMouseUp = useCallback(() => {
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    attachedListenersRef.current = null;

    // A mousemove can leave a frame scheduled that hasn't run yet. Cancel it so
    // it can't mutate size after we report the final size — otherwise onResize
    // would fire after onResizeEnd and the persisted/reported endSize would lag
    // the actual pane width by a frame.
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    currentMouseVectorRaf.current = null;

    setIsHeld(false);
    if (dragStartSizeRef.current !== null) {
      options.onResizeEnd?.({
        startSize: dragStartSizeRef.current,
        endSize: sizeRef.current,
      });
      dragStartSizeRef.current = null;
    }
  }, [onMouseMove, options]);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      setIsHeld(true);
      dragStartSizeRef.current = sizeRef.current;
      currentMouseVectorRaf.current = [evt.clientX, evt.clientY];

      attachedListenersRef.current = {onMouseMove, onMouseUp};
      document.addEventListener('mousemove', onMouseMove, {passive: true});
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  const onDoubleClick = useCallback(() => {
    updateSize(options.initialSize, true);
  }, [updateSize, options.initialSize]);

  // Unmount-only cleanup. If we unmount mid-drag, tear down everything an
  // in-flight drag left behind: the global listeners and the document styles it
  // mutated (pointer-events/cursor/user-select), plus any pending frame.
  // Without this, navigating away while holding the divider leaves the whole
  // app non-interactive because body pointer-events stay disabled.
  useLayoutEffect(() => {
    return () => {
      if (attachedListenersRef.current) {
        document.removeEventListener(
          'mousemove',
          attachedListenersRef.current.onMouseMove
        );
        document.removeEventListener('mouseup', attachedListenersRef.current.onMouseUp);
        attachedListenersRef.current = null;
        document.body.style.pointerEvents = '';
        document.body.style.userSelect = '';
        document.documentElement.style.cursor = '';
      }
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {size, isHeld, onMouseDown, onDoubleClick, setSize: updateSize};
}
