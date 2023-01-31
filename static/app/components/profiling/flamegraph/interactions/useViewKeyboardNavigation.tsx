import {useEffect, useRef} from 'react';
import {vec2} from 'gl-matrix';

import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {
  getCenterScaleMatrixFromConfigPosition,
  getTranslationMatrixFromConfigSpace,
} from 'sentry/utils/profiling/gl/utils';

const KEYDOWN_LISTENER_OPTIONS: AddEventListenerOptions & EventListenerOptions = {
  passive: true,
};

export function useViewKeyboardNavigation(
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager
) {
  const inertia = useRef<number | null>(null);

  useEffect(() => {
    if (!view) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!view) {
        return;
      }

      const elementType = document.activeElement?.nodeName.toLowerCase();
      if (elementType === 'input' || elementType === 'textarea') {
        return;
      }

      if (event.key === 'w') {
        if (inertia.current === null) {
          inertia.current = 1;
        }
        canvasPoolManager.dispatch('transform config view', [
          getCenterScaleMatrixFromConfigPosition(
            0.99 * inertia.current,
            vec2.fromValues(view.configView.centerX, view.configView.y)
          ),
          view,
        ]);
        inertia.current = Math.max(Math.abs(inertia.current * 0.99), 0.01);
      }

      if (event.key === 's') {
        if (inertia.current === null) {
          inertia.current = 1;
        }
        canvasPoolManager.dispatch('transform config view', [
          getCenterScaleMatrixFromConfigPosition(
            1.01 * inertia.current,
            vec2.fromValues(view.configView.centerX, view.configView.y)
          ),
          view,
        ]);
        inertia.current = inertia.current * 1.01;
      }
      if (event.key === 'a') {
        if (inertia.current === null) {
          // We'll start at 1% of the view width
          inertia.current = view.configView.width / 100;
        }
        canvasPoolManager.dispatch('transform config view', [
          getTranslationMatrixFromConfigSpace(1 * -inertia.current, 0),
          view,
        ]);
        inertia.current = inertia.current * 1.18;
      }
      if (event.key === 'd') {
        if (inertia.current === null) {
          // We'll start at 1% of the view width
          inertia.current = view.configView.width / 100;
        }
        canvasPoolManager.dispatch('transform config view', [
          getTranslationMatrixFromConfigSpace(1 * inertia.current, 0),
          view,
        ]);
        inertia.current = inertia.current * 1.18;
      }
    }

    function onKeyUp() {
      inertia.current = null;
    }

    document.addEventListener('keyup', onKeyUp, KEYDOWN_LISTENER_OPTIONS);
    document.addEventListener('keydown', onKeyDown, KEYDOWN_LISTENER_OPTIONS);

    return () => {
      document.removeEventListener('keyup', onKeyUp, KEYDOWN_LISTENER_OPTIONS);
      document.removeEventListener('keydown', onKeyDown, KEYDOWN_LISTENER_OPTIONS);
    };
  }, [view, canvasPoolManager]);
}
