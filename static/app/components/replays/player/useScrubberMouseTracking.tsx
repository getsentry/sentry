import {RefObject, useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
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

export function useTimelineScrubberMouseTracking<T extends Element>(
  {elem}: Opts<T>,
  scale: number
) {
  const {replay, currentTime, setCurrentHoverTime} = useReplayContext();
  const durationMs = replay?.getDurationMs();

  const handlePositionChange = useCallback(
    params => {
      if (!params || durationMs === undefined) {
        setCurrentHoverTime(undefined);
        return;
      }
      const {left, width} = params;
      const initialTranslate = 0.5 / scale;
      const percentComplete = divide(currentTime, durationMs);

      const starting = percentComplete < initialTranslate;
      const ending = percentComplete + initialTranslate > 1;

      if (left >= 0) {
        const time = () => {
          let percent = left / width;
          if (starting) {
            return (percent * durationMs) / scale;
          }
          if (ending) {
            return (percent * durationMs) / scale + (1 - 1 / scale) * durationMs;
          }
          percent = (left - width / 2) / width;
          return currentTime + (percent * durationMs) / scale;
        };
        setCurrentHoverTime(time());
      } else {
        setCurrentHoverTime(undefined);
      }
    },
    [durationMs, setCurrentHoverTime, currentTime, scale]
  );

  const mouseTrackingProps = useMouseTracking({
    elem,
    onPositionChange: handlePositionChange,
  });
  return mouseTrackingProps;
}

export default useScrubberMouseTracking;
