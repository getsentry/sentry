import {useCallback} from 'react';

import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {getCenterScaleMatrix} from 'sentry/utils/profiling/gl/utils';

export function useWheelCenterZoom(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager
) {
  const zoom = useCallback(
    (evt: WheelEvent) => {
      if (!canvas || !view) {
        return;
      }

      const scale = 1 - evt.deltaY * 0.01 * -1; // -1 to invert scale
      canvasPoolManager.dispatch('transform config view', [
        getCenterScaleMatrix(scale, evt.offsetX, evt.offsetY, view, canvas),
      ]);
    },
    [canvas, view, canvasPoolManager]
  );

  return zoom;
}
