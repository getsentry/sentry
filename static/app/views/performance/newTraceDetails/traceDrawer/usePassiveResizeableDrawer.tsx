import {useCallback, useLayoutEffect, useRef} from 'react';

export interface UsePassiveResizableDrawerOptions {
  direction: 'right' | 'left' | 'down' | 'up';
  initialSize: number;
  min: number;
  onResize: (size: number, min: number, user: boolean) => void;
  ref?: React.RefObject<HTMLElement>;
}

/**
 * Hook to support draggable container resizing
 *
 * This only resizes one dimension at a time.
 */
export function usePassiveResizableDrawer(options: UsePassiveResizableDrawerOptions): {
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  size: React.MutableRefObject<number>;
} {
  const rafIdRef = useRef<number | null>(null);
  const sizeRef = useRef(options.initialSize);
  const currentMouseVectorRaf = useRef<[number, number] | null>(null);

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  const {direction, initialSize, onResize} = options;
  useLayoutEffect(() => {
    sizeRef.current = initialSize;
    onResize(initialSize, options.min, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSize, direction, onResize]);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
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
        sizeRef.current = Math.round(
          Math.max(options.min, sizeRef.current + positionDelta * (isInverted ? -1 : 1))
        );
        onResize(sizeRef.current, options.min, true);
      });
    },
    [options.direction, onResize, options.min]
  );

  const onMouseUp = useCallback(() => {
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.documentElement.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      currentMouseVectorRaf.current = [evt.clientX, evt.clientY];

      document.addEventListener('mousemove', onMouseMove, {passive: false});
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  useLayoutEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  });

  return {onMouseDown, size: sizeRef};
}
