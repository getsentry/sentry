import {useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

type Props = {
  children: React.ReactNode;
};

function ScrubberMouseTracking({children}: Props) {
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

  const mouseTrackingProps = useMouseTracking<HTMLDivElement>({
    onPositionChange: handlePositionChange,
  });

  return <div {...mouseTrackingProps}>{children}</div>;
}

export default ScrubberMouseTracking;
