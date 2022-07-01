import React, {useCallback, useRef} from 'react';
import * as Sentry from '@sentry/react';

type CallbackArgs = {height: number; left: number; top: number; width: number};
export type Props = {
  children: React.ReactNode;
  onMouseMove: (args: undefined | CallbackArgs) => void;
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

function MouseTracking({onMouseMove, children}: Props) {
  const elem = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController>(new AbortController());

  const handleMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!elem.current) {
        onMouseMove(undefined);
        return;
      }

      try {
        const rect = await getBoundingRect(elem.current, {
          signal: controller.current.signal,
        });
        onMouseMove({
          height: rect.height,
          left: Math.min(e.clientX - rect.left, rect.width),
          top: Math.min(e.clientY - rect.top, rect.height),
          width: rect.width,
        });
      } catch (err) {
        if (err instanceof AbortError) {
          // Ignore cancelled getBoundingRect calls
          return;
        }

        Sentry.captureException(err);
      }
    },
    [onMouseMove, controller]
  );

  const onMouseLeave = useCallback(() => {
    if (controller.current) {
      controller.current.abort();
      controller.current = new AbortController();
    }

    onMouseMove(undefined);
  }, [onMouseMove, controller]);

  return (
    <div
      ref={elem}
      onMouseEnter={handleMouseMove}
      onMouseMove={handleMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

export default MouseTracking;
