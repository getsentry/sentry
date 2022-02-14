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

  const num = useRef(1);

  const isVCDSet = useRef(false);

  if (isVCDSet && hasData && performance && performance.mark) {
    performance.mark(`${id}-vcsd-start`);
    isVCDSet.current = true;
  }

  useEffect(() => {
    try {
      const transaction: any = getCurrentSentryReactTransaction(); // Using any to override types for private api.

      if (!isVisuallyCompleteSet.current) {
        const time = performance.now();
        transaction.registerBeforeFinishCallback((t, _) => {
          // Should be called after performance entries finish callback.
          t.setMeasurements({
            ...t._measurements,
            visuallyComplete: {value: time},
          });
        });
        isVisuallyCompleteSet.current = true;
      }
      if (!isDataCompleteSet.current && hasData) {
        isDataCompleteSet.current = true;

        setTimeout(() => {
          performance.mark(`${id}-vcsd-end`);
          performance.measure(
            `VCD [${id}] #${num.current}`,
            `${id}-vcsd-start`,
            `${id}-vcsd-end`
          );
          num.current = num.current++;
          const time = performance.now();
          transaction.registerBeforeFinishCallback(t => {
            // Should be called after performance entries finish callback.
            const lcp = t._measurements.lcp?.value;

            const newMeasurements = {
              ...t._measurements,
              visuallyCompleteData: {value: time},
            };

            if (lcp) {
              newMeasurements.lcpDiffVCD = {value: lcp - time};
            }

            t.setMeasurements(newMeasurements);
          });
        }, 0);
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
