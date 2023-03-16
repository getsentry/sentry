import {useEffect} from 'react';
import {vec2} from 'gl-matrix';

import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {requestAnimationFrameTimeout} from 'sentry/views/profiling/utils';

export function useCanvasZoomOrScroll({
  handleWheel,
  handleScroll,
  canvas,
  setConfigSpaceCursor,
  setLastInteraction,
  enableDefaultWheelEvents,
  canvasView,
}: {
  canvas: HTMLCanvasElement | null;
  canvasView: CanvasView<any> | null;
  enableDefaultWheelEvents: boolean;
  handleScroll: (evt: WheelEvent) => void;
  handleWheel: (evt: WheelEvent) => void;
  setConfigSpaceCursor: React.Dispatch<React.SetStateAction<vec2 | null>>;
  setLastInteraction: React.Dispatch<
    React.SetStateAction<'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null>
  >;
}) {
  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    let wheelStopTimeoutId: {current: number | undefined} = {current: undefined};
    function onCanvasWheel(evt: WheelEvent) {
      if (wheelStopTimeoutId.current !== undefined) {
        window.cancelAnimationFrame(wheelStopTimeoutId.current);
      }
      wheelStopTimeoutId = requestAnimationFrameTimeout(() => {
        setLastInteraction(null);
      }, 300);

      // We need to prevent the default behavior of the wheel event or we
      // risk triggering back/forward browser navigation
      // evt.preventDefault();

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the flamegraphView
      setConfigSpaceCursor(null);

      // pinch to zoom is recognized as `ctrlKey + wheelEvent`
      if (evt.metaKey || evt.ctrlKey) {
        // We need to prevent the default behavior of the wheel event or we
        // risk triggering back/forward browser navigation
        evt.preventDefault();

        handleWheel(evt);
        setLastInteraction('zoom');
      } else {
        // this currently does not work since the first few times we handle this event its against
        // the _old_ configView. as a result we see weird scrolling behavior between the window and the flamegraph
        const maxY = canvasView!.configSpace.height - canvasView!.configView.height;
        const isConfigViewAtEdge =
          canvasView?.configView.y === 0 || canvasView?.configView.y === maxY;

        if (!isConfigViewAtEdge) {
          evt.preventDefault();
        }
        handleScroll(evt);
        setLastInteraction('scroll');
      }
    }

    canvas.addEventListener('wheel', onCanvasWheel);

    return () => {
      if (wheelStopTimeoutId.current !== undefined) {
        window.cancelAnimationFrame(wheelStopTimeoutId.current);
      }
      canvas.removeEventListener('wheel', onCanvasWheel);
    };
  }, [
    canvas,
    handleWheel,
    handleScroll,
    setConfigSpaceCursor,
    setLastInteraction,
    enableDefaultWheelEvents,
    canvasView,
  ]);
}
