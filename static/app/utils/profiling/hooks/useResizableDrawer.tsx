import {useCallback, useEffect, useRef, useState} from 'react';

interface UseVerticallyResizableDrawerOptions {
  initialHeight: number;
  minHeight?: number;
}

export function useVerticallyResizableDrawer(
  options: UseVerticallyResizableDrawerOptions
) {
  const rafIdRef = useRef<number | null>(null);
  const startResizeVectorRef = useRef<[number, number] | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(options.initialHeight);

  const onMouseMove = useCallback(
    (mvEvent: MouseEvent) => {
      const rafId = rafIdRef.current;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafIdRef.current = null;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!startResizeVectorRef.current) {
          return;
        }
        const currentPositionVector: [number, number] = [
          mvEvent.clientX,
          mvEvent.clientY,
        ];

        const distance = [
          startResizeVectorRef.current[0] - currentPositionVector[0],
          startResizeVectorRef.current[1] - currentPositionVector[1],
        ];

        startResizeVectorRef.current = currentPositionVector;
        setDrawerHeight(h => Math.max(options.minHeight ?? 0, h + distance[1]));
      });
    },
    [options.minHeight]
  );

  const onMouseUp = useCallback(() => {
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

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  });

  return {height: drawerHeight, onMouseDown};
}
