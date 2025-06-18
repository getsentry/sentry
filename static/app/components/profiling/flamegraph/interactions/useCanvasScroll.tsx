import {useCallback} from 'react';

import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {getTranslationMatrixFromPhysicalSpace} from 'sentry/utils/profiling/gl/utils';

export function useCanvasScroll(
  canvas: FlamegraphCanvas | null,
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager,
  disablePanX = false
) {
  const onCanvasScroll = useCallback(
    (evt: WheelEvent) => {
      if (!canvas || !view) {
        return;
      }

      const direction =
        Math.abs(evt.deltaY) > Math.abs(evt.deltaX) ? 'vertical' : 'horizontal';
      const scrollDirection = evt.deltaY > 0 ? 'down' : 'up';

      if (
        view.isViewAtTopEdgeOf(view.configSpace) &&
        direction === 'vertical' &&
        scrollDirection === 'up'
      ) {
        return;
      }
      if (
        view.isViewAtBottomEdgeOf(view.configSpace) &&
        direction === 'vertical' &&
        scrollDirection === 'down'
      ) {
        return;
      }

      // Prevent scrolling the page and only scroll the canvas
      evt.preventDefault();
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
