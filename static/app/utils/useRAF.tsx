import {useEffect, useLayoutEffect, useRef} from 'react';

export function useRAF(callback: () => unknown, opts?: {enabled: boolean}) {
  const {enabled = true} = opts ?? {};
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (enabled) {
      let timer: number;
      let active = true;
      const tick = () => {
        callbackRef.current();
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
