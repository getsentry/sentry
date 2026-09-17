import {useEffect} from 'react';

export function useRAF(callback: () => unknown, opts?: {enabled: boolean}) {
  const {enabled = true} = opts ?? {};
  useEffect(() => {
    if (enabled) {
      const timer = window.requestAnimationFrame(callback);
      return () => window.cancelAnimationFrame(timer);
    }
    return () => {};
  }, [callback, enabled]);
}
