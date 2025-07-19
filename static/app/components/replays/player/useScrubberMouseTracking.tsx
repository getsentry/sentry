import type {RefObject} from 'react';
import {useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import useMouseTracking from 'sentry/utils/useMouseTracking';

type Opts<T extends Element> = {
  elem: RefObject<T | null>;
};

export function useScrubberMouseTracking<T extends Element>({elem}: Opts<T>) {
  const {replay} = useReplayContext();
  const [, setCurrentHoverTime] = useCurrentHoverTime();
  const durationMs = replay?.getDurationMs();

  const handlePositionChange = useCallback(
    (params: any) => {
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
