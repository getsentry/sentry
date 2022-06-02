import {useCallback, useState} from 'react';
import {vec2} from 'gl-matrix';

interface UseVerticallyResizableDrawerOptions {
  initialHeight: number;
  minHeight?: number;
}

export function useVerticallyResizableDrawer(
  options: UseVerticallyResizableDrawerOptions
) {
  const [drawerHeight, setDrawerHeight] = useState(options.initialHeight);

  const onMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      let startResizeVector = vec2.fromValues(evt.clientX, evt.clientY);
      let rafId: number | undefined;

      function handleMouseMove(mvEvent: MouseEvent) {
        if (rafId !== undefined) {
          window.cancelAnimationFrame(rafId);
          rafId = undefined;
        }

        window.requestAnimationFrame(() => {
          const currentPositionVector = vec2.fromValues(mvEvent.clientX, mvEvent.clientY);

          const distance = vec2.subtract(
            vec2.fromValues(0, 0),
            startResizeVector,
            currentPositionVector
          );

          startResizeVector = currentPositionVector;

          setDrawerHeight(h => Math.max(options.minHeight ?? 0, h + distance[1]));
          rafId = undefined;
        });
      }

      function handleMouseUp() {
        document.removeEventListener('mousemove', handleMouseMove);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);

        if (rafId !== undefined) {
          window.cancelAnimationFrame(rafId);
        }
      };
    },
    [options.minHeight]
  );

  return {height: drawerHeight, onMouseDown};
}
