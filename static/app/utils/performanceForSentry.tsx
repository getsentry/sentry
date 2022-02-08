import {Fragment, Profiler, ReactNode, useEffect, useRef} from 'react';
import {timestampWithMs} from '@sentry/utils';

import getCurrentSentryReactTransaction from './getCurrentSentryReactTransaction';

const MIN_UPDATE_SPAN_TIME = 16; // Frame boundary @ 60fps

/**
 * Callback for React Profiler https://reactjs.org/docs/profiler.html
 */
export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  try {
    const transaction = getCurrentSentryReactTransaction();
    if (transaction && actualDuration > MIN_UPDATE_SPAN_TIME) {
      const now = timestampWithMs();
      transaction.startChild({
        description: `<${id}>`,
        op: `ui.react.${phase}`,
        startTimestamp: now - actualDuration / 1000,
        endTimestamp: now,
      });
    }
  } catch (_) {
    // Add defensive catch since this wraps all of App
  }
}

export const VisuallyCompleteWithData = ({
  id,
  hasData,
  children,
}: {
  children: ReactNode;
  hasData: boolean;
  id: string;
}) => {
  const isVisuallyCompleteSet = useRef(false);
  const isDataCompleteSet = useRef(false);
  useEffect(() => {
    try {
      const transaction: any = getCurrentSentryReactTransaction(); // Using any to override types for private api.
      const now = performance.now();
      if (!isVisuallyCompleteSet.current) {
        transaction.setMeasurements({
          ...transaction._measurements,
          visuallyComplete: {value: now},
        });
        isVisuallyCompleteSet.current = true;
      }
      if (!isDataCompleteSet.current) {
        transaction.setMeasurements({
          ...transaction._measurements,
          visuallyCompleteData: {value: now},
        });
        isDataCompleteSet.current = true;
      }
    } catch (_) {
      // Defensive catch since this code is auxiliary.
    }
  }, [hasData]);

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      <Fragment>{children}</Fragment>
    </Profiler>
  );
};
