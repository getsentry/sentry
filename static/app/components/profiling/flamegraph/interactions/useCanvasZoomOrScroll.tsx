import {useEffect} from 'react';
import {vec2} from 'gl-matrix';

import {requestAnimationFrameTimeout} from 'sentry/views/profiling/utils';

export function useCanvasZoomOrScroll({
  handleWheel,
  handleScroll,
  canvas,
  setConfigSpaceCursor,
  setLastInteraction,
}: {
  canvas: HTMLCanvasElement | null;
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

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the flamegraphView
      setConfigSpaceCursor(null);

      // pinch to zoom is recognized as `ctrlKey + wheelEvent`
      if (evt.metaKey || evt.ctrlKey) {
        handleWheel(evt);
        setLastInteraction('zoom');
      } else {
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
  }, [canvas, handleWheel, handleScroll, setConfigSpaceCursor, setLastInteraction]);
}
