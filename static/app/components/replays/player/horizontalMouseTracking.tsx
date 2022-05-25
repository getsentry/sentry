import React, {useCallback, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {useReplayContext} from 'sentry/components/replays/replayContext';

type Props = {
  children: React.ReactNode;
};

class AbortError extends Error {}

/**
 * Replace `elem.getBoundingClientRect()` which is too laggy for onMouseMove
 */
function getBoundingRect(
  elem: Element,
  {signal}: {signal: AbortSignal}
): Promise<DOMRectReadOnly> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortError());
    }

    const abortHandler = () => {
      reject(new AbortError());
    };

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const bounds = entry.boundingClientRect;
        resolve(bounds);
        signal.removeEventListener('abort', abortHandler);
      }
      observer.disconnect();
    });
    signal.addEventListener('abort', abortHandler);
    observer.observe(elem);
  });
}

// TODO(replay): should this be an HoC?
function HorizontalMouseTracking({children}: Props) {
  const elem = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController>(new AbortController());
  const {duration, setCurrentHoverTime} = useReplayContext();

  const onMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!elem.current || duration === undefined) {
        setCurrentHoverTime(undefined);
        return;
      }

      try {
        const rect = await getBoundingRect(elem.current, {
          signal: controller.current.signal,
        });
        const left = e.clientX - rect.left;
        if (left >= 0) {
          const percent = left / rect.width;
          const time = percent * duration;
          setCurrentHoverTime(time);
        } else {
          setCurrentHoverTime(undefined);
        }
      } catch (err) {
        if (err instanceof AbortError) {
          // Ignore abortions
          return;
        }

        Sentry.captureException(err);
      }
    },
    [controller, duration, setCurrentHoverTime]
  );

  const onMouseLeave = useCallback(() => {
    if (controller.current) {
      controller.current.abort();
      controller.current = new AbortController();
    }

    setCurrentHoverTime(undefined);
  }, [controller, setCurrentHoverTime]);

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
