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

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function rafAnimation(
  ref: React.MutableRefObject<number | null>,
  cb: (easing: number) => void,
  done: () => void
) {
  const time = {
    start: 0,
    total: 160,
  };

  function tick(now: number) {
    if (!time.start) {
      time.start = now;
    }

    cb(easeOutCubic(1 - (now - time.start) / time.total));

    if (now - time.start < time.total) {
      ref.current = requestAnimationFrame(tick);
    } else {
      ref.current = null;
      done();
    }
  }

  ref.current = requestAnimationFrame(tick);
}

export function useViewKeyboardNavigation(
  view: CanvasView<any> | null,
  canvasPoolManager: CanvasPoolManager,
  pixelInConfigSpace: number
) {
  const holdingKeyRef = useRef<string | null>(null);
  const animationRef = useRef<number | null>(null);
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

      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }

      if (event.key === 'w') {
        if (inertia.current === null || holdingKeyRef.current !== 'w') {
          inertia.current = 0.005;
        }
        holdingKeyRef.current = 'w';

        rafAnimation(
          animationRef,
          easing => {
            const i = inertia.current ?? 1;
            canvasPoolManager.dispatch('transform config view', [
              getCenterScaleMatrixFromConfigPosition(
                vec2.fromValues(1 - easing * i, 1),
                vec2.fromValues(view.configView.centerX, view.configView.y)
              ),
              view,
            ]);
          },
          () => (inertia.current = null)
        );
        inertia.current = inertia.current * 1.08;
      }

      if (event.key === 's') {
        if (inertia.current === null || holdingKeyRef.current !== 's') {
          inertia.current = 0.005;
        }
        holdingKeyRef.current = 's';
        rafAnimation(
          animationRef,
          easing => {
            const i = inertia.current ?? 1;
            canvasPoolManager.dispatch('transform config view', [
              getCenterScaleMatrixFromConfigPosition(
                vec2.fromValues(1 + easing * i, 1),
                vec2.fromValues(view.configView.centerX, view.configView.y)
              ),
              view,
            ]);
          },
          () => (inertia.current = null)
        );
        inertia.current = inertia.current * 1.08;
      }
      if (event.key === 'a') {
        if (inertia.current === null || holdingKeyRef.current !== 'a') {
          // We'll start at 1% of the view width
          inertia.current = view.configView.width / 100;
        }
        holdingKeyRef.current = 'a';

        rafAnimation(
          animationRef,
          easing => {
            const i = inertia.current ?? 1;
            canvasPoolManager.dispatch('transform config view', [
              getTranslationMatrixFromConfigSpace(1 * -(easing * i), 0),
              view,
            ]);
          },
          () => (inertia.current = null)
        );
        inertia.current = inertia.current * 1.1;
      }
      if (event.key === 'd') {
        if (inertia.current === null || holdingKeyRef.current !== 'd') {
          // We'll start at 1% of the view width
          inertia.current = view.configView.width / 100;
        }
        holdingKeyRef.current = 'd';
        rafAnimation(
          animationRef,
          easing => {
            const i = inertia.current ?? 1;
            canvasPoolManager.dispatch('transform config view', [
              getTranslationMatrixFromConfigSpace(1 * easing * i, 0),
              view,
            ]);
          },
          () => (inertia.current = null)
        );
        inertia.current = inertia.current * 1.1;
      }
    }

    function onKeyUp() {
      if (!animationRef.current) {
        // if the animation finished, reset inertia
        inertia.current = null;
      }
      holdingKeyRef.current = null;
    }

    document.addEventListener('keyup', onKeyUp, KEYDOWN_LISTENER_OPTIONS);
    document.addEventListener('keydown', onKeyDown, KEYDOWN_LISTENER_OPTIONS);

    return () => {
      document.removeEventListener('keyup', onKeyUp, KEYDOWN_LISTENER_OPTIONS);
      document.removeEventListener('keydown', onKeyDown, KEYDOWN_LISTENER_OPTIONS);
    };
  }, [view, canvasPoolManager, pixelInConfigSpace]);
}
