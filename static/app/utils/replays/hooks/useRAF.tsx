import {useEffect} from 'react';

// TODO: move into app/utils/*
export default function useRAF(
  callback: () => unknown,
  opts?: {enabled: undefined | null | boolean}
) {
  const {enabled = true} = opts ?? {};
  useEffect(() => {
    if (enabled) {
      const timer = window.requestAnimationFrame(callback);
      return () => window.cancelAnimationFrame(timer);
    }
    return () => {};
  }, [callback, enabled]);
}
