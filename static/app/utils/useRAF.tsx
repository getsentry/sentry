import {useEffect, useEffectEvent} from 'react';

export function useRAF(callback: () => unknown, opts?: {enabled: boolean}) {
  const {enabled = true} = opts ?? {};
  const onFrame = useEffectEvent(callback);
  useEffect(() => {
    if (enabled) {
      // Keep polling even when the callback does not trigger a React render.
      let timer: number;
      const tick = () => {
        onFrame();
        timer = window.requestAnimationFrame(tick);
      };
      timer = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(timer);
    }
    return () => {};
  }, [enabled]);
}
