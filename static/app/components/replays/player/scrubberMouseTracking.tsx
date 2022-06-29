import {useCallback} from 'react';

import MouseTracking, {
  Props as MouseTrackingProps,
} from 'sentry/components/replays/mouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';

type OnMouseMoveParams = Parameters<MouseTrackingProps['onMouseMove']>;

type Props = {
  children: React.ReactNode;
};

function ScrubberMouseTracking({children}: Props) {
  const {duration = 0, setCurrentHoverTime} = useReplayContext();

  const handleMouseMove = useCallback(
    (params: OnMouseMoveParams[0]) => {
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

  return <MouseTracking onMouseMove={handleMouseMove}>{children}</MouseTracking>;
}

export default ScrubberMouseTracking;
