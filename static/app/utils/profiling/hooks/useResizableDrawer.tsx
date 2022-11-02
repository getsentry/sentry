import {useCallback, useLayoutEffect, useRef, useState} from 'react';

export interface UseResizableDrawerOptions {
  direction: 'horizontal-ltr' | 'horizontal-rtl' | 'vertical';
  min: [number, number];
  onResize: (
    newDimensions: [number, number],
    maybeOldDimensions?: [number, number]
  ) => void;
  initialDimensions?: [number, number];
}

export function useResizableDrawer(options: UseResizableDrawerOptions): {
  dimensions: [number, number];
  onMouseDown: React.MouseEventHandler<HTMLElement>;
} {
  const rafIdRef = useRef<number | null>(null);
  const startResizeVectorRef = useRef<[number, number] | null>(null);
  const [dimensions, setDimensions] = useState<[number, number]>([
    options.initialDimensions ? options.initialDimensions[0] : 0,
    options.initialDimensions ? options.initialDimensions[1] : 0,
  ]);

  // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden. If no initialDimensions are provided,
  // invoke the onResize callback with the previously stored dimensions.
  useLayoutEffect(() => {
    options.onResize(options.initialDimensions ?? [0, 0], dimensions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);

  const dimensionsRef = useRef<[number, number]>(dimensions);
  dimensionsRef.current = dimensions;

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      document.body.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!startResizeVectorRef.current) {
          return;
        }
        const currentPositionVector: [number, number] = [event.clientX, event.clientY];

        const distance = [
          startResizeVectorRef.current[0] - currentPositionVector[0],
          startResizeVectorRef.current[1] - currentPositionVector[1],
        ];

        startResizeVectorRef.current = currentPositionVector;

        const newDimensions: [number, number] = [
          // Round to 1px precision
          Math.round(
            Math.max(
              options.min[0],
              dimensionsRef.current[0] +
                // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                distance[0] * (options.direction === 'horizontal-ltr' ? -1 : 1)
            )
          ),
          // Round to 1px precision
          Math.round(
            // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
            Math.max(options.min[1] ?? 0, dimensionsRef.current[1] + distance[1])
          ),
        ];

        options.onResize(newDimensions);
        setDimensions(newDimensions);
      });
    },
    [options]
  );

  const onMouseUp = useCallback(() => {
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      startResizeVectorRef.current = [evt.clientX, evt.clientY];

      document.addEventListener('mousemove', onMouseMove, {passive: true});
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

  return {dimensions, onMouseDown};
}
