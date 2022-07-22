import {useCallback} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

type Props = {
  children: React.ReactNode;
};

function ScrubberMouseTracking({children}: Props) {
  const {duration = 0, setCurrentHoverTime} = useReplayContext();

  const handlePositionChange = useCallback(
    params => {
      if (!params || duration === undefined) {
        setCurrentHoverTime(undefined);
        return;
      }
      const {left, width} = params;

      if (left >= 0) {
        const percent = left / width;
        const time = percent * duration;
        setCurrentHoverTime(time);
      } else {
        setCurrentHoverTime(undefined);
      }
    },
    [duration, setCurrentHoverTime]
  );

  const mouseTrackingProps = useMouseTracking<HTMLDivElement>({
    onPositionChange: handlePositionChange,
  });

  return <div {...mouseTrackingProps}>{children}</div>;
}

export default ScrubberMouseTracking;
