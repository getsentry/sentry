import {useCallback, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import clamp from 'sentry/utils/number/clamp';

export interface UseResizableDrawerOptions {
  direction: 'right' | 'left' | 'down' | 'up';
  initialSize?: {height: number} | {width: number} | {height: number; width: number};
  max?: {height?: number; width?: number};
  min?: {height?: number; width?: number};
  onResize?: (options: {event: PointerEvent | null; size: number}) => number | string;
}

export interface UseResizableDrawerResult {
  resize: (size: NonNullable<UseResizableDrawerOptions['initialSize']>) => void;
  resizeHandleProps: {
    onPointerDown: React.PointerEventHandler<HTMLElement>;
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
  const handleElementRef = useRef<HTMLElement | null>(null);
  const pointerVectorRef = useRef<[number, number] | null>(null);
  const elementSizeRef = useRef<{height: number; width: number} | null>(null);

  const {onResize, direction, min, max, initialSize = {}} = options;
  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      event.stopPropagation();
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (!elementSizeRef.current) {
        Sentry.logger.warn(
          'useResizableDrawer: element size is not set, this should not happen'
        );
        return;
      }

      const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';

      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';
      document.documentElement.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize';

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (
          !pointerVectorRef.current ||
          !handleElementRef.current ||
          !elementSizeRef.current
        ) {
          return;
        }

        // @TODO:  This should only fire if the element is actully being resized
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

        if (typeof onResize === 'function') {
          const userSize =
            direction === 'right' || direction === 'left'
              ? {width: onResize({event, size})}
              : {height: onResize({event, size})};

          if (direction === 'right' || direction === 'left') {
            resizeElement(handleElementRef.current, userSize);

            if (typeof userSize === 'number') {
              updateSizeRef(elementSizeRef.current, userSize);
            }
          } else {
            resizeElement(handleElementRef.current, userSize);

            if (typeof userSize === 'number') {
              updateSizeRef(elementSizeRef.current, userSize);
            }
          }
          return;
        }

        const newSize = computeSizeFromPointerVectorDelta(
          axis,
          direction,
          previousPointerVector,
          currentPointerVector,
          elementSizeRef.current
        );

        if (direction === 'right' || direction === 'left') {
          resizeElement(handleElementRef.current, {
            width: clamp(
              newSize,
              min?.width ?? Number.NEGATIVE_INFINITY,
              max?.width ?? Number.POSITIVE_INFINITY
            ),
          });
          updateSizeRef(elementSizeRef.current, {width: newSize});
        } else {
          resizeElement(handleElementRef.current, {
            height: clamp(
              newSize,
              min?.height ?? Number.NEGATIVE_INFINITY,
              max?.height ?? Number.POSITIVE_INFINITY
            ),
          });
          updateSizeRef(elementSizeRef.current, {height: newSize});
        }
      });
    },
    [direction, onResize, min, max]
  );

  const onPointerUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    elementSizeRef.current = null;

    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    // setResizing(false);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (evt: React.PointerEvent<HTMLElement>) => {
      const boundingClientRect = handleElementRef.current?.getBoundingClientRect();

      if (boundingClientRect) {
        elementSizeRef.current = {
          width: boundingClientRect.width,
          height: boundingClientRect.height,
        };
      }

      pointerVectorRef.current = [evt.clientX, evt.clientY];

      document.addEventListener('pointermove', onPointerMove, {passive: true});
      document.addEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp]
  );

  const resizeHandleRef = useCallback(
    (element: HTMLElement | null) => {
      if (element) {
        element.style.cursor =
          direction === 'right' || direction === 'left' ? 'ew-resize' : 'ns-resize';
      }
    },
    [direction]
  );

  const {width, height} = initialSize;
  const elementRef = useCallback(
    (element: HTMLElement | null) => {
      handleElementRef.current = element;

      if (element) {
        if (typeof onResize === 'function') {
          if (initialSize === undefined) {
            return;
          }

          const size =
            typeof width === 'number'
              ? width
              : typeof height === 'number'
                ? height
                : undefined;

          if (!size) {
            return;
          }

          const userSize = onResize({event: null, size});
          resizeElement(
            element,
            direction === 'right' || direction === 'left'
              ? {width: userSize}
              : {height: userSize}
          );
        } else {
          resizeElement(element, initialSize);
        }
      }

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
    },
    [direction, onResize]
  );

  const onProgrammaticResize = useCallback(
    (newSize: NonNullable<UseResizableDrawerOptions['initialSize']>) => {
      if (!handleElementRef.current) {
        return;
      }

      if (
        (direction === 'right' || direction === 'left') &&
        'width' in newSize &&
        typeof newSize.width === 'number'
      ) {
        const boundingClientRect = handleElementRef.current.getBoundingClientRect();
        resizeElement(handleElementRef.current, {width: newSize.width});
        elementSizeRef.current = {
          width: newSize.width,
          height: boundingClientRect.height,
        };
      } else if (
        (direction === 'down' || direction === 'up') &&
        'height' in newSize &&
        typeof newSize.height === 'number'
      ) {
        const boundingClientRect = handleElementRef.current.getBoundingClientRect();
        resizeElement(handleElementRef.current, {height: newSize.height});
        elementSizeRef.current = {
          height: newSize.height,
          width: boundingClientRect.width,
        };
      }
    },
    [direction]
  );

  return {
    resizeHandleProps: {onPointerDown, ref: resizeHandleRef},
    resizedElementProps: {ref: elementRef},
    resize: onProgrammaticResize,
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
  const inverted = direction === 'down' || direction === 'left';
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
  ref: {height: number; width: number},
  options: {height?: number; width?: number}
) {
  if ('width' in options && options.width !== undefined) {
    ref.width = options.width;
  }
  if ('height' in options && options.height !== undefined) {
    ref.height = options.height;
  }
}

function resizeElement(
  ref: HTMLElement,
  options: {height?: number | string; width?: number | string}
) {
  if ('width' in options && options.width !== undefined) {
    ref.style.width =
      typeof options.width === 'string' ? options.width : `${options.width}px`;
  } else {
    ref.style.width = '';
  }

  if ('height' in options && options.height !== undefined) {
    ref.style.height =
      typeof options.height === 'string' ? options.height : `${options.height}px`;
  } else {
    ref.style.height = '';
  }
}
