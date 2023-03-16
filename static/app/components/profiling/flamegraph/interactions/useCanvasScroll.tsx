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

      // ideally we capture the new configView here and assert
      // against its bounds, then decide if we preventDefault or not
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
