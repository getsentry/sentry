import {useEffect} from 'react';

export function useRAF(callback: () => unknown, opts?: {enabled: boolean}) {
  const {enabled = true} = opts ?? {};
  useEffect(() => {
    if (enabled) {
      const timer = globalThis.requestAnimationFrame(callback);
      return () => globalThis.cancelAnimationFrame(timer);
    }
    return () => {};
  }, [callback, enabled]);
}
