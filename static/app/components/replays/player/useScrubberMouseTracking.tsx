import {RefObject, useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

type Opts<T extends Element> = {
  elem: RefObject<T>;
};

export function useScrubberMouseTracking<T extends Element>({elem}: Opts<T>) {
  const {replay, setCurrentHoverTime} = useReplayContext();
  const durationMs = replay?.getDurationMs();

  const handlePositionChange = useCallback(
    params => {
      if (!params || durationMs === undefined) {
        setCurrentHoverTime(undefined);
        return;
      }
      const {left, width} = params;

      if (left >= 0) {
        const percent = left / width;
        const time = percent * durationMs;
        setCurrentHoverTime(time);
      } else {
        setCurrentHoverTime(undefined);
      }
    },
    [durationMs, setCurrentHoverTime]
  );

  const mouseTrackingProps = useMouseTracking({
    elem,
    onPositionChange: handlePositionChange,
  });
  return mouseTrackingProps;
}

export default useScrubberMouseTracking;
