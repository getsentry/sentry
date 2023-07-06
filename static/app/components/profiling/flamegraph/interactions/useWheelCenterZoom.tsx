import {useCallback} from 'react';
import {vec2} from 'gl-matrix';

import {getCenterScaleMatrixFromMousePosition} from 'sentry/domains/profiling/utils/gl/utils';
import {CanvasPoolManager} from 'sentry/domains/profiling/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/domains/profiling/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/domains/profiling/utils/profiling/flamegraphCanvas';

export function useWheelCenterZoom(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager,
  disable: boolean = false
) {
  const zoom = useCallback(
    (evt: WheelEvent) => {
      if (!canvas || !view || disable) {
        return;
      }

      evt.preventDefault();

      const scale = 1 - evt.deltaY * 0.01 * -1; // -1 to invert scale
      canvasPoolManager.dispatch('transform config view', [
        getCenterScaleMatrixFromMousePosition(
          scale,
          vec2.fromValues(evt.offsetX, evt.offsetY),
          view,
          canvas
        ),
        view,
      ]);
    },
    [canvas, view, canvasPoolManager, disable]
  );

  return zoom;
}
