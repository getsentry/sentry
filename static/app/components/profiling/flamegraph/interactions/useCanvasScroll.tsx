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

      const direction =
        Math.abs(evt.deltaY) > Math.abs(evt.deltaX) ? 'vertical' : 'horizontal';
      const scrollDirection = evt.deltaY > 0 ? 'down' : 'up';

      // if the view is inverted, then the top edge is the bottom edge
      // and the bottom edge is the top edge so we need to invert the checks

      const isTopEdge = view.inverted
        ? view.configSpace.bottom === view.configView.bottom
        : view.configSpace.top === view.configView.top;
      const isBottomEdge = view.inverted
        ? view.configSpace.top === view.configView.top
        : view.configSpace.bottom === view.configView.bottom;

      if (isTopEdge && direction === 'vertical' && scrollDirection === 'up') {
        return;
      }
      if (isBottomEdge && direction === 'vertical' && scrollDirection === 'down') {
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
