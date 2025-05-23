import {useCallback, useRef, useState} from 'react';

import clamp from 'sentry/utils/number/clamp';

export interface UseResizableDrawerOptions {
  direction: 'right' | 'left' | 'down' | 'up';
  initialSize?: {height?: number; width?: number};
  max?: {height?: number; width?: number};
  min?: {height?: number; width?: number};
  onResize?: (options: {
    event: MouseEvent | null;
    size: number;
  }) => number | string | null;
}

export interface UseResizableDrawerResult {
  resize: (size: NonNullable<UseResizableDrawerOptions['initialSize']>) => void;
  resizeHandleProps: {
    onMouseDown: React.MouseEventHandler<HTMLElement>;
    ref: React.RefCallback<HTMLElement>;
  };
  resizedElementProps: {
    ref: React.RefCallback<HTMLElement>;
  };
  resizing: boolean;
}

/**
 * Hook to support draggable container resizing
 *
 * This only resizes one dimension at a time.
 */
export function useResizableDrawer(
  options: UseResizableDrawerOptions
): UseResizableDrawerResult {
  const [resizing, setResizing] = useState(false);

  const rafIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const handleRef = useRef<HTMLElement | null>(null);

  const elementSizeRef = useRef<{height: number; width: number} | null>(null);
  const pointerVectorRef = useRef<[number, number] | null>(null);

  const {onResize, direction, min, max, initialSize = {}} = options;
  const {width, height} = initialSize;

  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;

  /**
   * Used by callers to programmatically resize the element from outside the hook.
   */
  const onCallerResize = useCallback(
    (newSize: NonNullable<UseResizableDrawerOptions['initialSize']>) => {
      if (!containerRef.current) {
        return;
      }

      const boundingClientRect = containerRef.current.getBoundingClientRect();
      resizeElement(containerRef.current, {
        width: 'width' in newSize ? newSize.width : undefined,
        height: 'height' in newSize ? newSize.height : undefined,
      });

      elementSizeRef.current = {
        width: boundingClientRect.width,
        height: boundingClientRect.height,
      };
    },
    []
  );

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (!elementSizeRef.current) {
        return;
      }

      const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';

      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';
      document.documentElement.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize';

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (
          !pointerVectorRef.current ||
          !containerRef.current ||
          !elementSizeRef.current
        ) {
          return;
        }

        setResizing(true);

        const previousPointerVector: [number, number] = pointerVectorRef.current;
        const currentPointerVector: [number, number] = [event.clientX, event.clientY];
        pointerVectorRef.current = currentPointerVector;

        const size = computeSizeFromPointerVectorDelta(
          axis,
          direction,
          previousPointerVector,
          currentPointerVector,
          elementSizeRef.current
        );

        // If user passes onResize, we will call that function to see if they want to override the size
        // - if they return null, we will bail out of the resize event
        // - if they return a number, we will use that number as the new size
        // - if they return anything else, attempt to resize the element and query the DOM for the new size
        if (typeof resizeRef.current === 'function') {
          const bounds: [number, number] =
            direction === 'right' || direction === 'left'
              ? [min?.width ?? 0, max?.width ?? Number.POSITIVE_INFINITY]
              : [min?.height ?? 0, max?.height ?? Number.POSITIVE_INFINITY];

          const clampedSize = clamp(size, ...bounds);
          const userSize = resizeRef.current?.({event, size: clampedSize});

          if (userSize === null) {
            // We don't know the new size, so we need to query the DOM.
            const boundingClientRect = containerRef.current?.getBoundingClientRect();
            updateSizeRef(elementSizeRef.current, {
              width: boundingClientRect?.width,
              height: boundingClientRect?.height,
            });
            return;
          }

          resizeElement(
            containerRef.current,
            direction === 'right' || direction === 'left'
              ? {width: userSize}
              : {height: userSize}
          );

          // If a number was returned, update it without querying the DOM
          if (typeof userSize === 'number') {
            updateSizeRef(elementSizeRef.current, {
              width: direction === 'right' || direction === 'left' ? userSize : undefined,
              height: direction === 'down' || direction === 'up' ? userSize : undefined,
            });
          } else {
            // The new size cannot be known, so we need to query the DOM.
            const boundingClientRect = containerRef.current?.getBoundingClientRect();
            updateSizeRef(elementSizeRef.current, {
              width: boundingClientRect?.width,
              height: boundingClientRect?.height,
            });
          }

          return;
        }

        // Default behavior is to recompute the size ourselves based off the pointer vector delta
        // resize the element and update the size ref with the new size.
        const newSize = computeSizeFromPointerVectorDelta(
          axis,
          direction,
          previousPointerVector,
          currentPointerVector,
          elementSizeRef.current
        );

        resizeElement(containerRef.current, {
          width:
            direction === 'right' || direction === 'left'
              ? clamp(newSize, min?.width ?? 0, max?.width ?? Number.POSITIVE_INFINITY)
              : undefined,
          height:
            direction === 'down' || direction === 'up'
              ? clamp(newSize, min?.height ?? 0, max?.height ?? Number.POSITIVE_INFINITY)
              : undefined,
        });
        updateSizeRef(
          elementSizeRef.current,
          direction === 'right' || direction === 'left'
            ? {width: newSize}
            : {height: newSize}
        );
      });
    },
    [direction, min, max]
  );

  const onMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    elementSizeRef.current = null;

    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    setResizing(false);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      const boundingClientRect = containerRef.current?.getBoundingClientRect();

      if (boundingClientRect) {
        elementSizeRef.current = {
          width: boundingClientRect.width,
          height: boundingClientRect.height,
        };
      }

      pointerVectorRef.current = [evt.clientX, evt.clientY];

      document.addEventListener('mousemove', onMouseMove, {passive: true});
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  // We need to call the resize callback on both refs, as some implementations
  // rely on it to absolutely position the handle element inside the container.
  // If we don't do that, then we are implicitly relying on rendering order,
  // which means that the handle element might never get properly positioned on initial render.
  const initializeOnRef = useCallback(() => {
    if (containerRef.current) {
      if (typeof resizeRef.current === 'function') {
        const size =
          typeof width === 'number'
            ? width
            : typeof height === 'number'
              ? height
              : undefined;

        if (!size) {
          return;
        }

        const userSize = resizeRef.current?.({event: null, size});

        if (userSize === null) {
          return;
        }

        resizeElement(
          containerRef.current,
          direction === 'right' || direction === 'left'
            ? {width: userSize}
            : {height: userSize}
        );
      } else {
        resizeElement(containerRef.current, {
          width,
          height,
        });
      }

      const boundingClientRect = containerRef.current?.getBoundingClientRect();
      updateSizeRef(elementSizeRef.current, {
        width: boundingClientRect?.width,
        height: boundingClientRect?.height,
      });
    }
  }, [direction, width, height]);

  const initializeOnRefRef = useRef<typeof initializeOnRef>(initializeOnRef);
  initializeOnRefRef.current = initializeOnRef;

  const elementContainerRef = useCallback(
    (element: HTMLElement | null) => {
      containerRef.current = element;
      initializeOnRefRef.current();
    },
    [initializeOnRefRef]
  );

  const resizeHandleRef = useCallback(
    (element: HTMLElement | null) => {
      handleRef.current = element;
      initializeOnRefRef.current();

      if (element) {
        element.style.cursor =
          direction === 'right' || direction === 'left' ? 'ew-resize' : 'ns-resize';
      }
    },
    [direction, initializeOnRefRef]
  );

  return {
    resizeHandleProps: {onMouseDown, ref: resizeHandleRef},
    resizedElementProps: {ref: elementContainerRef},
    resize: onCallerResize,
    resizing,
  };
}

function computeSizeFromPointerVectorDelta(
  axis: 'x' | 'y',
  direction: 'right' | 'left' | 'down' | 'up',
  previousPointerVector: [number, number],
  currentPointerVector: [number, number],
  elementSizeRef: {height: number; width: number}
) {
  const inverted = direction === 'down' || direction === 'right';
  const distance =
    axis === 'x'
      ? previousPointerVector[0] - currentPointerVector[0]
      : previousPointerVector[1] - currentPointerVector[1];

  const vectorDelta = Math.round(distance * (inverted ? -1 : 1));

  return axis === 'x'
    ? elementSizeRef.width + vectorDelta
    : elementSizeRef.height + vectorDelta;
}

function updateSizeRef(
  ref: {height: number; width: number} | null,
  options: {height?: number; width?: number}
) {
  if (!ref) return;
  if (options.width !== undefined) ref.width = options.width;
  if (options.height !== undefined) ref.height = options.height;
}

function resizeElement(
  ref: HTMLElement,
  options: {height?: number | string; width?: number | string}
) {
  ref.style.width =
    options.width === undefined
      ? ''
      : typeof options.width === 'string'
        ? options.width
        : `${options.width}px`;

  ref.style.height =
    options.height === undefined
      ? ''
      : typeof options.height === 'string'
        ? options.height
        : `${options.height}px`;
}
