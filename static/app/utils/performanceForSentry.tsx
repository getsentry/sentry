import {Fragment, Profiler, ReactNode, useEffect, useRef} from 'react';
import {captureMessage, setExtra, setTag} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {IdleTransaction} from '@sentry/tracing';
import {
  type MeasurementUnit,
  type Transaction,
  type TransactionEvent,
} from '@sentry/types';
import {
  _browserPerformanceTimeOriginMode,
  browserPerformanceTimeOrigin,
  timestampWithMs,
} from '@sentry/utils';

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
          performance.measure(
            `VCD [${id}] #${num.current}`,
            `${id}-vcsd-start`,
            `${id}-vcsd-end`
          );
          num.current = num.current++;
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

/**
 * Creates aggregate measurements for assets to understand asset size impact on performance.
 * The `hasAnyAssetTimings` is also added here since the asset information depends on the `allow-timing-origin` header.
 */
const addAssetMeasurements = (transaction: TransactionEvent) => {
  const spans = transaction.spans;

  if (!spans) {
    return;
  }

  let allTransfered = 0;
  let allEncoded = 0;
  let hasAssetTimings = false;

  for (const [op, _] of Object.entries(OP_ASSET_MEASUREMENT_MAP)) {
    const filtered = spans.filter(
      s =>
        s.op === op &&
        SENTRY_ASSET_DOMAINS.every(
          domain => !s.description || s.description.includes(domain)
        )
    );
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
  transaction.tags.hasAnyAssetTimings = hasAssetTimings;
};

const addCustomMeasurements = (transaction: TransactionEvent) => {
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

  const context: MeasurementContext = {
    transaction,
    ttfb: ttfb[1].value,
    browserTimeOrigin: browserPerformanceTimeOrigin,
    transactionStart: transaction.start_timestamp,
  };
  for (const [name, fn] of Object.entries(customMeasurements)) {
    const measurement = fn(context);
    if (measurement) {
      transaction.measurements[name] = measurement;
    }
  }
};

interface Measurement {
  unit: MeasurementUnit;
  value: number;
}
interface MeasurementContext {
  browserTimeOrigin: number;
  transaction: TransactionEvent;
  transactionStart: number;
  ttfb: number;
}

const getVCDSpan = (transaction: TransactionEvent) =>
  transaction.spans?.find(s => s.description?.startsWith('VCD'));
const getBundleLoadSpan = (transaction: TransactionEvent) =>
  transaction.spans?.find(s => s.description === 'app.page.bundle-load');

const customMeasurements: Record<
  string,
  (ctx: MeasurementContext) => Measurement | undefined
> = {
  /**
   * Budget measurement between the time to first byte (the beginning of the response) and the beginning of our
   * webpack bundle load. Useful for us since we have an entrypoint script we want to measure the impact of.
   *
   * Performance budget: **0 ms**
   *
   * - We should get rid of delays before loading the main app bundle to improve performance.
   */
  pre_bundle_load: ({ttfb, browserTimeOrigin, transactionStart}) => {
    const headMark = performance.getEntriesByName('head-start')[0];

    if (!headMark) {
      return undefined;
    }

    const entryStartSeconds = browserTimeOrigin / 1000 + headMark.startTime / 1000;
    const value = (entryStartSeconds - transactionStart) * 1000 - ttfb;
    return {
      value,
      unit: 'millisecond',
    };
  },
  /**
   * Budget measurement representing the `app.page.bundle-load` measure.
   * We can use this to track asset transfer performance impact over time as a measurement.
   *
   * Performance budget: **__** ms
   *
   */
  bundle_load: ({transaction}) => {
    const span = getBundleLoadSpan(transaction);
    if (!span?.endTimestamp || !span?.startTimestamp) {
      return undefined;
    }
    return {
      value: span?.endTimestamp - span?.startTimestamp,
      unit: 'seconds',
    };
  },
  /**
   * Experience measurement representing the time when the first "visually complete" component approximately *finishes* rendering on the page.
   * - Provided by the {@link VisuallyCompleteWithData} wrapper component.
   * - This only fires when it receives a non-empty data set for that component. Which won't capture onboarding or empty states,
   *   but most 'happy path' performance for using any product occurs only in views with data.
   *
   * This should replace LCP as a 'load' metric when it's present, since it also works on navigations.
   */
  visually_complete_with_data: ({transaction, transactionStart}) => {
    const vcdSpan = getVCDSpan(transaction);
    if (!vcdSpan?.endTimestamp) {
      return undefined;
    }
    const value = vcdSpan?.endTimestamp - transactionStart;
    return {
      value,
      unit: 'seconds',
    };
  },

  /**
   * Budget measurement for the time between loading the bundle and a visually complete component finishing it's render.
   *
   * For now this is a quite broad measurement but can be roughly be broken down into:
   * - Post bundle load application initialization
   * - Http waterfalls for data
   * - Rendering of components, including the VCD component.
   */
  init_to_vcd: ({transaction}) => {
    const bundleSpan = getBundleLoadSpan(transaction);
    const vcdSpan = getVCDSpan(transaction);
    if (!vcdSpan?.endTimestamp) {
      return undefined;
    }
    const timestamp = bundleSpan?.endTimestamp || 0; // Default to 0 so this works for navigations.
    return {
      value: vcdSpan.endTimestamp - timestamp,
      unit: 'seconds',
    };
  },
};

export const addExtraMeasurements = (transaction: TransactionEvent) => {
  try {
    addAssetMeasurements(transaction);
    addCustomMeasurements(transaction);
  } catch (_) {
    // Defensive catch since this code is auxiliary.
  }
};

/**
 * A util function to help create some broad buckets to group entity counts without exploding cardinality.
 *
 * @param tagName - Name for the tag, will create `<tagName>` in data and `<tagname>.grouped` as a tag
 * @param max - The approximate maximum value for the tag, A bucket between max and Infinity is also captured so it's fine if it's not precise, the data won't be entirely lost.
 * @param n - The value to be grouped, should represent `n` entities.
 * @param [buckets=[1,2,5]] - An optional param to specify the bucket progression. Default is 1,2,5 (10,20,50 etc).
 */
export const setGroupedEntityTag = (
  tagName: string,
  max: number,
  n: number,
  buckets = [1, 2, 5]
) => {
  setExtra(tagName, n);
  let groups = [0];
  loop: for (let m = 1, mag = 0; m <= max; m *= 10, mag++) {
    for (const i of buckets) {
      const group = i * 10 ** mag;
      if (group > max) {
        break loop;
      }
      groups = [...groups, group];
    }
  }
  groups = [...groups, +Infinity];
  setTag(`${tagName}.grouped`, `<=${groups.find(g => n <= g)}`);
};
