import {useCallback, useRef} from 'react';

function useTimeout({timeMs, callback}: {callback: () => void; timeMs: number}) {
  const timeoutRef = useRef<number>(null);

  const saveTimeout = useCallback((timeout: ReturnType<typeof setTimeout> | null) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-expect-error
    timeoutRef.current = timeout;
  }, []);

  return {
    start: () => saveTimeout(setTimeout(callback, timeMs)),
    stop: () => saveTimeout(null),
  };
}

export default useTimeout;
