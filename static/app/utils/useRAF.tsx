import {useEffect, useEffectEvent} from 'react';

export function useRAF(callback: () => unknown, opts?: {enabled: boolean}) {
  const {enabled = true} = opts ?? {};
  const onFrame = useEffectEvent(callback);
  useEffect(() => {
    if (enabled) {
      // Keep polling even when the callback does not trigger a React render.
      let timer: number;
      let active = true;
      const tick = () => {
        onFrame();
        if (active) {
          timer = window.requestAnimationFrame(tick);
        }
      };
      timer = window.requestAnimationFrame(tick);
      return () => {
        active = false;
        window.cancelAnimationFrame(timer);
      };
    }
    return () => {};
  }, [enabled]);
}
