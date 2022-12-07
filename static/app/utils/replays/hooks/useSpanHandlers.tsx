import {useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

function useSpanHandlers(startTimestampMs: number = 0) {
  const {setCurrentHoverTime, setCurrentTime} = useReplayContext();

  const handleMouseEnter = useCallback(
    (span: NetworkSpan) => {
      if (startTimestampMs) {
        setCurrentHoverTime(
          relativeTimeInMs(span.startTimestamp ?? 0 * 1000, startTimestampMs)
        );
      }
    },
    [setCurrentHoverTime, startTimestampMs]
  );

  const handleMouseLeave = useCallback(
    (_span: NetworkSpan) => {
      setCurrentHoverTime(undefined);
    },
    [setCurrentHoverTime]
  );

  const handleClick = useCallback(
    (span: NetworkSpan) => {
      if (startTimestampMs) {
        setCurrentTime(
          relativeTimeInMs(span.startTimestamp ?? 0 * 1000, startTimestampMs)
        );
      }
    },
    [setCurrentTime, startTimestampMs]
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
  };
}

export default useSpanHandlers;
