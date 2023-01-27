import {useCallback} from 'react';

import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {getCenterScaleMatrixFromMousePosition} from 'sentry/utils/profiling/gl/utils';

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
        getCenterScaleMatrixFromMousePosition(
          scale,
          evt.offsetX,
          evt.offsetY,
          view,
          canvas
        ),
        view,
      ]);
    },
    [canvas, view, canvasPoolManager]
  );

  return zoom;
}
