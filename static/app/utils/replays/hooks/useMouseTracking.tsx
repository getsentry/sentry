import {DOMAttributes, MouseEvent, useCallback, useRef} from 'react';
import * as Sentry from '@sentry/react';

type CallbackArgs = {height: number; left: number; top: number; width: number};

type Opts = {
  onPositionChange: (args: undefined | CallbackArgs) => void;
} & DOMAttributes<HTMLDivElement>;

class AbortError extends Error {}

/**
 * Replace `elem.getBoundingClientRect()` which is too laggy for onPositionChange
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

function useMouseTracking({onPositionChange, ...rest}: Opts) {
  const elem = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController>(new AbortController());

  const handlePositionChange = useCallback(
    async (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!elem.current) {
        onPositionChange(undefined);
        return;
      }

      try {
        const rect = await getBoundingRect(elem.current, {
          signal: controller.current.signal,
        });
        onPositionChange({
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
    [onPositionChange, controller]
  );

  const onMouseLeave = useCallback(() => {
    if (controller.current) {
      controller.current.abort();
      controller.current = new AbortController();
    }

    onPositionChange(undefined);
  }, [onPositionChange, controller]);

  return {
    ref: elem,
    ...rest,
    onMouseEnter: e => {
      handlePositionChange(e);
      rest.onMouseEnter?.(e);
    },
    onMouseMove: e => {
      handlePositionChange(e);
      rest.onMouseMove?.(e);
    },
    onMouseLeave: e => {
      onMouseLeave();
      rest.onMouseLeave?.(e);
    },
  };
}

export default useMouseTracking;
