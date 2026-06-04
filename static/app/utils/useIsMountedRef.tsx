import {useEffect, useRef} from 'react';

/**
 * Returns a ref that captures the current mounted state of the component
 *
 * This hook is handy for the cases when you have to detect component mount state
 * within async effects.
 */
export function useIsMountedRef() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}
