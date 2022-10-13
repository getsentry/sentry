import {useCallback, useState} from 'react';

import useTimeout from 'sentry/utils/useTimeout';

const HOVERCARD_CONTENT_DELAY = 400;

export function useDelayedLoadingState() {
  const [shouldShowLoadingState, setShouldShowLoadingState] = useState(false);

  const onTimeout = useCallback(() => {
    setShouldShowLoadingState(true);
  }, []);

  const {start, end, cancel} = useTimeout({
    timeMs: HOVERCARD_CONTENT_DELAY,
    onTimeout,
  });

  const reset = useCallback(() => {
    setShouldShowLoadingState(false);
    cancel();
  }, [cancel]);

  return {
    shouldShowLoadingState,
    onRequestBegin: start,
    onRequestEnd: end,
    reset,
  };
}
