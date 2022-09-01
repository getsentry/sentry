import {useCallback, useRef} from 'react';

function useTimeout({timeMs, onTimeout}: {onTimeout: () => void; timeMs: number}) {
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
    /**
     * Start the timer
     *
     * If there was a previous timer, then it will be cancelled.
     */
    start: useCallback(() => {
      saveTimeout(null);
      saveTimeout(setTimeout(onTimeout, timeMs));
    }, [onTimeout, saveTimeout, timeMs]),

    /**
     * Cancel the current timer
     *
     * Does not run the onTimeout callback.
     */
    cancel: useCallback(() => {
      saveTimeout(null);
    }, [saveTimeout]),

    /**
     * Stop the current timer
     *
     * Will run the onTimeout callback.
     */
    end: useCallback(() => {
      saveTimeout(null);
      onTimeout();
    }, [onTimeout, saveTimeout]),
  };
}

export default useTimeout;
