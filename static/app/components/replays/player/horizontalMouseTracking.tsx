import React, {useCallback, useRef} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';

type Props = {
  children: React.ReactNode;
};

/**
 * Replace `elem.getBoundingClientRect()` which is too laggy for onMouseMove
 */
function getBoundingRect(elem: Element): Promise<DOMRectReadOnly> {
  return new Promise((resolve, _reject) => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const bounds = entry.boundingClientRect;
        resolve(bounds);
      }
      observer.disconnect();
    });
    observer.observe(elem);
  });
}

// TODO(replay): should this be an HoC?
function HorizontalMouseTracking({children}: Props) {
  const elem = useRef<HTMLDivElement>(null);
  const {duration, setCurrentHoverTime} = useReplayContext();

  const onMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!elem.current || duration === undefined) {
        setCurrentHoverTime(undefined);
        return;
      }

      const rect = await getBoundingRect(elem.current);
      const left = e.clientX - rect.left;
      if (left >= 0) {
        const percent = left / rect.width;
        const time = percent * duration;
        setCurrentHoverTime(time);
      } else {
        setCurrentHoverTime(undefined);
      }
    },
    [duration, setCurrentHoverTime]
  );

  const onMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  return (
    <div
      ref={elem}
      onMouseEnter={onMouseMove}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

export default HorizontalMouseTracking;
