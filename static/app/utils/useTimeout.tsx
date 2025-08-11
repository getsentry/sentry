import {useCallback, useEffect, useRef} from 'react';

interface Options {
  onTimeout: () => void;
  timeMs: number;
}

export default function useTimeout({timeMs, onTimeout}: Options) {
  const timeoutRef = useRef<number | null>(null);

  const saveTimeout = useCallback((timeout: number | null) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = timeout;
  }, []);

  const start = useCallback(() => {
    saveTimeout(null);
    saveTimeout(window.setTimeout(onTimeout, timeMs));
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
