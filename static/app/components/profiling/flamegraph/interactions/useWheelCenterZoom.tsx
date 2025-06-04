import {useCallback} from 'react';
import {vec2} from 'gl-matrix';

import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {getCenterScaleMatrixFromMousePosition} from 'sentry/utils/profiling/gl/utils';

export function useWheelCenterZoom(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager,
  disable = false
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
