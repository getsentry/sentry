import {useEffect} from 'react';

// TODO: move into app/utils/*
export default function useRAF(callback: () => unknown) {
  useEffect(() => {
    const timer = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame(timer);
  }, [callback]);
}
