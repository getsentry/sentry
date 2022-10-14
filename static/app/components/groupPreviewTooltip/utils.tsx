import {useCallback, useState} from 'react';

import useTimeout from 'sentry/utils/useTimeout';

const HOVERCARD_CONTENT_DELAY = 400;

export function useDelayedLoadingState() {
  const [shouldShowLoadingState, setShouldShowLoadingState] = useState(false);

  const {start, end} = useTimeout({
    timeMs: HOVERCARD_CONTENT_DELAY,
    onTimeout: () => {
      setShouldShowLoadingState(true);
    },
  });

  const reset = useCallback(() => {
    setShouldShowLoadingState(false);
  }, []);

  return {
    shouldShowLoadingState,
    onRequestBegin: start,
    onRequestEnd: end,
    reset,
  };
}
