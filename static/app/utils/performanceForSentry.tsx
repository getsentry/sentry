import {Fragment, Profiler, ReactNode, useEffect, useRef} from 'react';
import {captureException, captureMessage} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {IdleTransaction} from '@sentry/tracing';
import {Transaction, TransactionEvent} from '@sentry/types';
import {browserPerformanceTimeOrigin, timestampWithMs} from '@sentry/utils';

import getCurrentSentryReactTransaction from './getCurrentSentryReactTransaction';

const MIN_UPDATE_SPAN_TIME = 16; // Frame boundary @ 60fps
const WAIT_POST_INTERACTION = 50; // Leave a small amount of time for observers and onRenderCallback to log since they come in after they occur and not during.
const INTERACTION_TIMEOUT = 2 * 60_000; // 2min. Wrap interactions up after this time since we don't want transactions sticking around forever.

/**
 * It depends on where it is called but the way we fetch transactions can be empty despite an ongoing transaction existing.
 * This will return an interaction-type transaction held onto by a class static if one exists.
 */
export function getPerformanceTransaction(): IdleTransaction | Transaction | undefined {
  return PerformanceInteraction.getTransaction() ?? getCurrentSentryReactTransaction();
}

/**
 * Callback for React Profiler https://reactjs.org/docs/profiler.html
 */
export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  try {
    const transaction: Transaction | undefined = getPerformanceTransaction();
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

export class PerformanceInteraction {
  private static interactionTransaction: Transaction | null = null;
  private static interactionTimeoutId: number | undefined = undefined;

  static getTransaction() {
    return PerformanceInteraction.interactionTransaction;
  }

  static startInteraction(name: string, timeout = INTERACTION_TIMEOUT, immediate = true) {
    try {
      const currentIdleTransaction = getCurrentSentryReactTransaction();
      if (currentIdleTransaction) {
        // If interaction is started while idle still exists.
        currentIdleTransaction.setTag('finishReason', 'sentry.interactionStarted'); // Override finish reason so we can capture if this has effects on idle timeout.
        currentIdleTransaction.finish();
      }
      PerformanceInteraction.finishInteraction(immediate);

      const txn = Sentry?.startTransaction({
        name: `ui.${name}`,
        op: 'interaction',
      });

      PerformanceInteraction.interactionTransaction = txn;

      // Auto interaction timeout
      PerformanceInteraction.interactionTimeoutId = window.setTimeout(() => {
        if (!PerformanceInteraction.interactionTransaction) {
          return;
        }
        PerformanceInteraction.interactionTransaction.setTag(
          'ui.interaction.finish',
          'timeout'
        );
        PerformanceInteraction.finishInteraction(true);
      }, timeout);
    } catch (e) {
      captureMessage(e);
    }
  }

  static async finishInteraction(immediate = false) {
    try {
      if (!PerformanceInteraction.interactionTransaction) {
        return;
      }
      clearTimeout(PerformanceInteraction.interactionTimeoutId);

      if (immediate) {
        PerformanceInteraction.interactionTransaction?.finish();
        PerformanceInteraction.interactionTransaction = null;
        return;
      }

      // Add a slight wait if this isn't called as the result of another transaction starting.
      await new Promise(resolve => setTimeout(resolve, WAIT_POST_INTERACTION));
      PerformanceInteraction.interactionTransaction?.finish();
      PerformanceInteraction.interactionTransaction = null;

      return;
    } catch (e) {
      captureMessage(e);
    }
  }
}

export class LongTaskObserver {
  private static observer: PerformanceObserver;
  private static longTaskCount = 0;
  private static longTaskDuration = 0;
  private static lastTransaction: IdleTransaction | Transaction | undefined;

  static setLongTaskData(t: IdleTransaction | Transaction) {
    const group =
      [
        1, 2, 5, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1001,
      ].find(n => LongTaskObserver.longTaskCount <= n) || -1;
    t.setTag('ui.longTaskCount.grouped', group < 1001 ? `<=${group}` : `>1000`);

    t.setMeasurement('longTaskCount', LongTaskObserver.longTaskCount, '');
    t.setMeasurement('longTaskDuration', LongTaskObserver.longTaskDuration, '');
  }

  static startPerformanceObserver(): PerformanceObserver | null {
    try {
      if (LongTaskObserver.observer) {
        LongTaskObserver.observer.disconnect();
        try {
          LongTaskObserver.observer.observe({entryTypes: ['longtask']});
        } catch (_) {
          // Safari doesn't support longtask, ignore this error.
        }
        return LongTaskObserver.observer;
      }
      if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
        return null;
      }

      const observer = new PerformanceObserver(function () {
        try {
          const transaction = getPerformanceTransaction();
          if (!transaction) {
            return;
          }

          if (transaction !== LongTaskObserver.lastTransaction) {
            // If long tasks observer is active and is called while the transaction has changed.
            if (LongTaskObserver.lastTransaction) {
              LongTaskObserver.setLongTaskData(LongTaskObserver.lastTransaction);
            }
            LongTaskObserver.longTaskCount = 0;
            LongTaskObserver.longTaskDuration = 0;
            LongTaskObserver.lastTransaction = transaction;
          }
          LongTaskObserver.setLongTaskData(transaction);
        } catch (_) {
          // Defensive catch.
        }
      });

      if (!observer || !observer.observe) {
        return null;
      }
      LongTaskObserver.observer = observer;
      try {
        LongTaskObserver.observer.observe({entryTypes: ['longtask']});
      } catch (_) {
        // Safari doesn't support longtask, ignore this error.
      }

      return LongTaskObserver.observer;
    } catch (e) {
      captureException(e);
      // Defensive try catch.
    }
    return null;
  }
}

export const CustomerProfiler = ({id, children}: {children: ReactNode; id: string}) => {
  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
};

/**
 * This component wraps the main component on a page with a measurement checking for visual completedness.
 * It uses the data check to make sure endpoints have resolved and the component is meaningfully rendering
 * which sets it apart from simply checking LCP, which makes it a good back up check the LCP heuristic performance.
 *
 * Since this component is guaranteed to be part of the -real- critical path, it also wraps the component with the custom profiler.
 */
export const VisuallyCompleteWithData = ({
  id,
  hasData,
  children,
}: {
  children: ReactNode;
  hasData: boolean;
  id: string;
}) => {
  const isDataCompleteSet = useRef(false);
  const longTaskCount = useRef(0);

  useEffect(() => {
    let observer;
    try {
      if (!window.PerformanceObserver || !browserPerformanceTimeOrigin) {
        return () => {};
      }
      observer = LongTaskObserver.startPerformanceObserver();
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

          transaction.registerBeforeFinishCallback((t: Transaction) => {
            if (!browserPerformanceTimeOrigin) {
              return;
            }
            // Should be called after performance entries finish callback.
            const lcp = (t as any)._measurements.lcp?.value;

            // Adjust to be relative to transaction.startTimestamp
            const entryStartSeconds =
              browserPerformanceTimeOrigin / 1000 + measureEntry.startTime / 1000;
            const time = (entryStartSeconds - transaction.startTimestamp) * 1000;

            if (lcp) {
              t.setMeasurement('lcpDiffVCD', lcp - time, 'millisecond');
            }

            t.setTag('longTaskCount', longTaskCount.current);
            t.setMeasurement('visuallyCompleteData', time, 'millisecond');
          });
        }, 0);
      }
    } catch (_) {
      // Defensive catch since this code is auxiliary.
    }
  }, [hasData, id]);

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      <Fragment>{children}</Fragment>
    </Profiler>
  );
};

interface OpAssetMeasurementDefinition {
  key: string;
}

const OP_ASSET_MEASUREMENT_MAP: Record<string, OpAssetMeasurementDefinition> = {
  'resource.script': {
    key: 'script',
  },
};
const ASSET_MEASUREMENT_ALL = 'allResources';
const SENTRY_ASSET_DOMAINS = ['sentry-cdn.com'];

const measureAssetsOnTransaction = (transaction: TransactionEvent) => {
  const spans = transaction.spans;

  if (!spans) {
    return;
  }

  let allTransfered = 0;
  let allEncoded = 0;
  let allCount = 0;
  let hasAssetTimings = false;

  for (const [op, _] of Object.entries(OP_ASSET_MEASUREMENT_MAP)) {
    const filtered = spans.filter(
      s =>
        s.op === op &&
        SENTRY_ASSET_DOMAINS.every(
          domain => !s.description || s.description.includes(domain)
        )
    );
    const count = filtered.length;
    const transfered = filtered.reduce(
      (acc, curr) => acc + (curr.data['Transfer Size'] ?? 0),
      0
    );
    const encoded = filtered.reduce(
      (acc, curr) => acc + (curr.data['Encoded Body Size'] ?? 0),
      0
    );

    if (encoded > 0) {
      hasAssetTimings = true;
    }

    allCount += count;
    allTransfered += transfered;
    allEncoded += encoded;
  }

  if (!transaction.measurements || !transaction.tags) {
    return;
  }

  transaction.measurements[`${ASSET_MEASUREMENT_ALL}.encoded`] = {
    value: allEncoded,
    unit: 'byte',
  };
  transaction.measurements[`${ASSET_MEASUREMENT_ALL}.transfer`] = {
    value: allTransfered,
    unit: 'byte',
  };
  transaction.measurements[`${ASSET_MEASUREMENT_ALL}.count`] = {
    value: allCount,
    unit: 'none',
  };
  transaction.tags.hasAnyAssetTimings = hasAssetTimings;
};

const additionalMeasurements = (transaction: TransactionEvent) => {
  if (
    !transaction.measurements ||
    !browserPerformanceTimeOrigin ||
    !transaction.start_timestamp
  ) {
    return;
  }

  const ttfb = Object.entries(transaction.measurements).find(([key]) =>
    key.toLowerCase().includes('ttfb')
  );

  if (!ttfb || !ttfb[1]) {
    return;
  }

  const headMark = performance.getEntriesByName('head-start')[0];

  if (!headMark) {
    return;
  }

  const ttfbValue = ttfb[1].value;

  const entryStartSeconds =
    browserPerformanceTimeOrigin / 1000 + headMark.startTime / 1000;
  const time = (entryStartSeconds - transaction.start_timestamp) * 1000 - ttfbValue;

  transaction.measurements.pre_bundle_load = {
    value: time,
    unit: 'millisecond',
  };
};

export const addExtraMeasurements = (transaction: TransactionEvent) => {
  try {
    measureAssetsOnTransaction(transaction);
    additionalMeasurements(transaction);
  } catch (_) {
    // Defensive catch since this code is auxiliary.
  }
};
