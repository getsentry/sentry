import {Fragment, Profiler, ReactNode, useEffect, useRef} from 'react';
import {captureException} from '@sentry/react';
import {browserPerformanceTimeOrigin, timestampWithMs} from '@sentry/utils';

import getCurrentSentryReactTransaction from './getCurrentSentryReactTransaction';

const MIN_UPDATE_SPAN_TIME = 5; // Frame boundary @ 60fps

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

class LongTaskObserver {
  private static observer: PerformanceObserver;
  private static longTaskCount = 0;
  private static currentId: string;
  static getPerformanceObserver(id: string): PerformanceObserver | null {
    try {
      LongTaskObserver.currentId = id;
      if (LongTaskObserver.observer) {
        LongTaskObserver.observer.disconnect();
        LongTaskObserver.observer.observe({entryTypes: ['longtask']});
        return LongTaskObserver.observer;
      }
      if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
        return null;
      }
      const transaction: any = getCurrentSentryReactTransaction();

      const timeOrigin = browserPerformanceTimeOrigin / 1000;

      const observer = new PerformanceObserver(function (list) {
        const perfEntries = list.getEntries();

        if (!transaction) {
          return;
        }
        perfEntries.forEach(entry => {
          const startSeconds = timeOrigin + entry.startTime / 1000;
          LongTaskObserver.longTaskCount++;
          transaction.startChild({
            description: `Long Task - ${LongTaskObserver.currentId}`,
            op: `ui.sentry.long-task`,
            startTimestamp: startSeconds,
            endTimestamp: startSeconds + entry.duration / 1000,
          });
        });
      });

      if (!transaction) {
        return null;
      }
      transaction?.registerBeforeFinishCallback?.(t => {
        if (!browserPerformanceTimeOrigin) {
          return;
        }

        t.setTag('longTaskCount', LongTaskObserver.longTaskCount);
      });

      if (!observer || !observer.observe) {
        return null;
      }
      LongTaskObserver.observer = observer;
      LongTaskObserver.observer.observe({entryTypes: ['longtask']});

      return LongTaskObserver.observer;
    } catch (e) {
      captureException(e);
      // Defensive try catch.
    }
    return null;
  }
}

export const ProfilerWithTasks = ({id, children}: {children: ReactNode; id: string}) => {
  useEffect(() => {
    let observer;
    try {
      if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
        return () => {};
      }
      observer = LongTaskObserver.getPerformanceObserver(id);
    } catch (e) {
      captureException(e);
      // Defensive since this is auxiliary code.
    }
    return () => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
};

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
    let observer;
    try {
      if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
        return () => {};
      }
      observer = LongTaskObserver.getPerformanceObserver(id);
    } catch (_) {
      // Defensive since this is auxiliary code.
    }
    return () => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
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

        window.setTimeout(() => {
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
