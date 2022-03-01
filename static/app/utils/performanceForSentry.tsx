import {Fragment, Profiler, ReactNode, useEffect, useRef} from 'react';
import {browserPerformanceTimeOrigin, timestampWithMs} from '@sentry/utils';

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
  const longTaskCount = useRef(0);

  useEffect(() => {
    if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
      return () => {};
    }
    const timeOrigin = browserPerformanceTimeOrigin / 1000;

    const observer = new PerformanceObserver(function (list) {
      const perfEntries = list.getEntries();

      const transaction = getCurrentSentryReactTransaction();
      if (!transaction) {
        return;
      }
      perfEntries.forEach(entry => {
        const startSeconds = timeOrigin + entry.startTime / 1000;
        longTaskCount.current++;
        transaction.startChild({
          description: `Long Task - ${id}`,
          op: `ui.long-task`,
          startTimestamp: startSeconds,
          endTimestamp: startSeconds + entry.duration / 1000,
        });
      });
    });
    observer.observe({entryTypes: ['longtask']});
    return () => {
      observer.disconnect();
    };
  }, []);

  const num = useRef(1);

  const isVCDSet = useRef(false);

  if (isVCDSet && hasData && performance && performance.mark) {
    performance.mark(`${id}-vcsd-start`);
    isVCDSet.current = true;
  }

  useEffect(() => {
    try {
      const transaction: any = getCurrentSentryReactTransaction(); // Using any to override types for private api.
      if (!transaction) {
        return;
      }

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

        performance.mark(`${id}-vcsd-end-pre-timeout`);

        setTimeout(() => {
          if (!browserPerformanceTimeOrigin) {
            return;
          }
          performance.mark(`${id}-vcsd-end`);
          const measureName = `VCD [${id}] #${num.current}`;
          performance.measure(
            `VCD [${id}] #${num.current}`,
            `${id}-vcsd-start`,
            `${id}-vcsd-end`
          );
          num.current = num.current++;
          const [measureEntry] = performance.getEntriesByName(measureName);
          if (!measureEntry) {
            return;
          }

          transaction.registerBeforeFinishCallback(t => {
            if (!browserPerformanceTimeOrigin) {
              return;
            }
            // Should be called after performance entries finish callback.
            const lcp = t._measurements.lcp?.value;

            // Adjust to be relative to transaction.startTimestamp
            const entryStartSeconds =
              browserPerformanceTimeOrigin / 1000 + measureEntry.startTime / 1000;
            const time = (entryStartSeconds - transaction.startTimestamp) * 1000;

            const newMeasurements = {
              ...t._measurements,
              visuallyCompleteData: {value: time},
            };

            if (lcp) {
              newMeasurements.lcpDiffVCD = {value: lcp - time};
            }

            t.setTag('longTaskCount', longTaskCount.current);
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
