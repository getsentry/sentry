import {useCallback, useEffect, useRef} from 'react';

type Options = {
  onTimeout: () => void;
  timeMs: number;
};

function useTimeout({timeMs, onTimeout}: Options) {
  const timeoutRef = useRef<number>(null);

  const saveTimeout = useCallback((timeout: ReturnType<typeof setTimeout> | null) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-ignore TS(2540): Cannot assign to 'current' because it is a read-on... Remove this comment to see the full error message
    timeoutRef.current = timeout;
  }, []);

  const start = useCallback(() => {
    saveTimeout(null);
    saveTimeout(setTimeout(onTimeout, timeMs));
  }, [onTimeout, saveTimeout, timeMs]);

  const cancel = useCallback(() => {
    saveTimeout(null);
  }, [saveTimeout]);

  const end = useCallback(() => {
    saveTimeout(null);
    onTimeout();
  }, [onTimeout, saveTimeout]);

  // Cancel the timeout on unmount
  useEffect(() => cancel, [cancel]);

  return {
    /**
     * Start the timer
     *
     * If there was a previous timer, then it will be cancelled.
     */
    start,
    /**
     * Cancel the current timer
     *
     * Does not run the onTimeout callback.
     */
    cancel,
    /**
     * Stop the current timer
     *
     * Will run the onTimeout callback.
     */
    end,
  };
}

export default useTimeout;
