import {useCallback} from 'react';
import {mat3, vec2} from 'gl-matrix';

import {type CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {type CanvasView} from 'sentry/utils/profiling/canvasView';
import {type FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';

export function useCanvasScroll(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager
) {
  const onCanvasScroll = useCallback(
    (evt: WheelEvent) => {
      if (!canvas || !view) {
        return;
      }

      {
        const physicalDelta = vec2.fromValues(evt.deltaX * 0.8, evt.deltaY);
        const physicalToConfig = mat3.invert(
          mat3.create(),
          view.fromConfigView(canvas.physicalSpace)
        );
        const [m00, m01, m02, m10, m11, m12] = physicalToConfig;

        const configDelta = vec2.transformMat3(vec2.create(), physicalDelta, [
          m00,
          m01,
          m02,
          m10,
          m11,
          m12,
          0,
          0,
          0,
        ]);

        const translate = mat3.fromTranslation(mat3.create(), configDelta);
        canvasPoolManager.dispatch('transform config view', [translate, view]);
      }
    },
    [canvas, view, canvasPoolManager]
  );

  return onCanvasScroll;
}
