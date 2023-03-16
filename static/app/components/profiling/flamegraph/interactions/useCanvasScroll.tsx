import {useCallback} from 'react';

import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {getTranslationMatrixFromPhysicalSpace} from 'sentry/utils/profiling/gl/utils';

export function useCanvasScroll(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager,
  disablePanX: boolean = false
) {
  const onCanvasScroll = useCallback(
    (evt: WheelEvent) => {
      if (!canvas || !view) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [
        getTranslationMatrixFromPhysicalSpace(
          disablePanX ? 0 : evt.deltaX,
          evt.deltaY,
          view,
          canvas
        ),
        view,
      ]);
    },
    [canvas, view, canvasPoolManager, disablePanX]
  );

  return onCanvasScroll;
}
