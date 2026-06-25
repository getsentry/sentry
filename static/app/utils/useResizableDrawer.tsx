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

function clampSize(value: number, min: number, max: number | undefined) {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, value));
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
   * Apply to the drag handle element. Supports touch and pen input.
   */
  onPointerDown: React.PointerEventHandler<HTMLElement>;
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

    // Clamp the seed so a stale persisted value or an initialSize below min
    // never enters as the size; bounds are enforced from the very first render.
    return clampSize(storedSize || options.initialSize, options.min, options.max);
  });
  const [isHeld, setIsHeld] = useState(false);
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const updateSize = useCallback((newSize: number, userEvent = false) => {
    sizeRef.current = newSize;
    setSize(newSize);
    optionsRef.current.onResize(newSize, undefined, userEvent);
    if (optionsRef.current.sizeStorageKey) {
      localStorage.setItem(optionsRef.current.sizeStorageKey, newSize.toString());
    }
  }, []);

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  useLayoutEffect(() => {
    const clamped = clampSize(options.initialSize ?? 0, options.min, options.max);
    options.onResize(clamped, size, false);
    setSize(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onDragMove = useCallback(
    (event: MouseEvent | PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
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
          clampSize(
            sizeRef.current + positionDelta * (isInverted ? -1 : 1),
            options.min,
            options.max
          )
        );

        updateSize(newSize, true);
      });
    },
    [options.direction, options.min, options.max, updateSize]
  );

  const dragStartSizeRef = useRef<number | null>(null);

  const onDragEnd = useCallback(() => {
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
    setIsHeld(false);
    if (dragStartSizeRef.current !== null) {
      options.onResizeEnd?.({
        startSize: dragStartSizeRef.current,
        endSize: sizeRef.current,
      });
      dragStartSizeRef.current = null;
    }
  }, [onDragMove, options]);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    // Re-clamp to the current [min, max] before the drag begins: bounds can
    // tighten after mount (e.g. the viewport shrinks the measured max) without
    // re-clamping the stored size, which would otherwise leave the delta math
    // and the reported startSize stepping from a stale, out-of-range value.
    const {min, max} = optionsRef.current;
    const clamped = clampSize(sizeRef.current, min, max);
    // Raw state setter (not updateSize): keep the returned size in sync without
    // firing onResize/persisting on mere drag-start. No-ops when already in range.
    sizeRef.current = clamped;
    setSize(clamped);
    setIsHeld(true);
    dragStartSizeRef.current = clamped;
    currentMouseVectorRaf.current = [clientX, clientY];
  }, []);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      if (evt.button !== 0) {
        return;
      }

      evt.preventDefault();
      startDrag(evt.clientX, evt.clientY);
      document.addEventListener('mousemove', onDragMove, {passive: false});
      document.addEventListener('mouseup', onDragEnd);
    },
    [onDragMove, onDragEnd, startDrag]
  );

  const onPointerDown = useCallback(
    (evt: React.PointerEvent<HTMLElement>) => {
      if (!evt.isPrimary || (evt.pointerType === 'mouse' && evt.button !== 0)) {
        return;
      }

      evt.preventDefault();
      startDrag(evt.clientX, evt.clientY);
      document.addEventListener('pointermove', onDragMove, {passive: false});
      document.addEventListener('pointerup', onDragEnd);
      document.addEventListener('pointercancel', onDragEnd);
    },
    [onDragMove, onDragEnd, startDrag]
  );

  const onDoubleClick = useCallback(() => {
    updateSize(options.initialSize, true);
  }, [updateSize, options.initialSize]);

  useLayoutEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  });

  return {size, isHeld, onMouseDown, onPointerDown, onDoubleClick, setSize: updateSize};
}
