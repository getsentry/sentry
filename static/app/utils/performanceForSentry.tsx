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

import {useLocation} from 'sentry/utils/useLocation';
import usePrevious from 'sentry/utils/usePrevious';

const MIN_UPDATE_SPAN_TIME = 16; // Frame boundary @ 60fps
const WAIT_POST_INTERACTION = 50; // Leave a small amount of time for observers and onRenderCallback to log since they come in after they occur and not during.
const INTERACTION_TIMEOUT = 2 * 60_000; // 2min. Wrap interactions up after this time since we don't want transactions sticking around forever.
const MEASUREMENT_OUTLIER_VALUE = 5 * 60_000; // Measurements over 5 minutes don't get recorded as a metric and are tagged instead.
const ASSET_OUTLIER_VALUE = 1_000_000_000; // Assets over 1GB are ignored since they are likely a reporting error.
const VCD_START = 'vcd-start';
const VCD_END = 'vcd-end';

/**
 * It depends on where it is called but the way we fetch transactions can be empty despite an ongoing transaction existing.
 * This will return an interaction-type transaction held onto by a class static if one exists.
 */
export function getPerformanceTransaction(): IdleTransaction | Transaction | undefined {
  return PerformanceInteraction.getTransaction() ?? Sentry.getActiveTransaction();
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
      const currentIdleTransaction = Sentry.getActiveTransaction();
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

export function CustomProfiler({id, children}: {children: ReactNode; id: string}) {
  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}

/**
 * This component wraps the main component on a page with a measurement checking for visual completedness.
 * It uses the data check to make sure endpoints have resolved and the component is meaningfully rendering
 * which sets it apart from simply checking LCP, which makes it a good back up check the LCP heuristic performance.
 *
 * Since this component is guaranteed to be part of the -real- critical path, it also wraps the component with the custom profiler.
 */
export function VisuallyCompleteWithData({
  id,
  hasData,
  children,
  disabled,
  isLoading,
}: {
  children: ReactNode;
  hasData: boolean;
  id: string;
  disabled?: boolean;
  /**
   * Add isLoading to also collect navigation timings, since the data state is sometimes constant before the reload occurs.
   */
  isLoading?: boolean;
}) {
  const location = useLocation();
  const previousLocation = usePrevious(location);

  const isDataCompleteSet = useRef(false);

  const num = useRef(1);

  const isVCDSet = useRef(false);

  if (isVCDSet && hasData && performance && performance.mark && !disabled) {
    performance.mark(`${id}-${VCD_START}`);
    isVCDSet.current = true;
  }

  const _hasData = isLoading === undefined ? hasData : hasData && !isLoading;

  useEffect(() => {
    // Capture changes in location to reset VCD as it's likely indicative of a route change.
    if (location !== previousLocation) {
      isDataCompleteSet.current = false;
      performance
        .getEntriesByType('mark')
        .map(m => m.name)
        .filter(n => n.includes('vcd'))
        .forEach(n => performance.clearMarks(n));
    }
  }, [location, previousLocation]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    try {
      const transaction: any = Sentry.getActiveTransaction(); // Using any to override types for private api.
      if (!transaction) {
        return;
      }

      if (!isDataCompleteSet.current && _hasData) {
        isDataCompleteSet.current = true;

        performance.mark(`${id}-${VCD_END}-pretimeout`);

        window.setTimeout(() => {
          if (!browserPerformanceTimeOrigin) {
            return;
          }
          performance.mark(`${id}-${VCD_END}`);
          const startMarks = performance.getEntriesByName(`${id}-${VCD_START}`);
          const endMarks = performance.getEntriesByName(`${id}-${VCD_END}`);
          if (startMarks.length > 1 || endMarks.length > 1) {
            transaction.setTag('vcd_extra_recorded_marks', true);
          }

          const startMark = startMarks.at(-1);
          const endMark = endMarks.at(-1);
          if (!startMark || !endMark) {
            return;
          }
          performance.measure(
            `VCD [${id}] #${num.current}`,
            `${id}-${VCD_START}`,
            `${id}-${VCD_END}`
          );
          num.current = num.current++;
        }, 0);
      }
    } catch (_) {
      // Defensive catch since this code is auxiliary.
    }
  }, [_hasData, disabled, id]);

  if (disabled) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      <Fragment>{children}</Fragment>
    </Profiler>
  );
}

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
  const getOperation = data => data.operation ?? '';
  const getTransferSize = data =>
    data['http.response_transfer_size'] ?? data['Transfer Size'] ?? 0;
  const getEncodedSize = data =>
    data['http.response_content_length'] ?? data['Encoded Body Size'] ?? 0;
  const getDecodedSize = data =>
    data['http.decoded_response_content_length'] ?? data['Decoded Body Size'] ?? 0;
  const getFields = data => ({
    operation: getOperation(data),
    transferSize: getTransferSize(data),
    encodedSize: getEncodedSize(data),
    decodedSize: getDecodedSize(data),
  });

  for (const [op, _] of Object.entries(OP_ASSET_MEASUREMENT_MAP)) {
    const filtered = spans.filter(
      s =>
        s.op === op &&
        SENTRY_ASSET_DOMAINS.some(
          domain =>
            !s.description ||
            s.description.includes(domain) ||
            s.description.startsWith('/')
        )
    );
    const transfered = filtered.reduce((acc, curr) => {
      const fields = getFields(curr.data);
      if (fields.transferSize > ASSET_OUTLIER_VALUE) {
        return acc;
      }
      return acc + fields.transferSize;
    }, 0);
    const encoded = filtered.reduce((acc, curr) => {
      const fields = getFields(curr.data);
      if (
        fields.encodedSize > ASSET_OUTLIER_VALUE ||
        (fields.encodedSize > 0 && fields.decodedSize === 0)
      ) {
        // There appears to be a bug where we have massive encoded sizes w/o a decode size, we'll ignore these assets for now.
        return acc;
      }
      return acc + fields.encodedSize;
    }, 0);

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
  if (!browserPerformanceTimeOrigin || !transaction.start_timestamp) {
    return;
  }

  const measurements: Record<string, Measurement> = {...transaction.measurements};

  const ttfb = Object.entries(measurements).find(([key]) =>
    key.toLowerCase().includes('ttfb')
  );

  const ttfbValue = ttfb?.[1]?.value;

  const context: MeasurementContext = {
    transaction,
    ttfb: ttfbValue,
    browserTimeOrigin: browserPerformanceTimeOrigin,
    transactionStart: transaction.start_timestamp,
    transactionOp: (transaction.contexts?.trace?.op as string) ?? 'pageload',
  };

  for (const [name, fn] of Object.entries(customMeasurements)) {
    const measurement = fn(context);
    if (measurement) {
      if (
        measurement.unit === 'millisecond' &&
        measurement.value > MEASUREMENT_OUTLIER_VALUE
      ) {
        // exclude outlier measurements and don't add any of the custom measurements in case something is wrong.
        if (transaction.tags) {
          transaction.tags.outlier_vcd = name;
        }
        return;
      }
      measurements[name] = measurement;
    }
  }

  transaction.measurements = measurements;
};

interface Measurement {
  unit: MeasurementUnit;
  value: number;
}
interface MeasurementContext {
  browserTimeOrigin: number;
  transaction: TransactionEvent;
  transactionOp: string;
  transactionStart: number;
  ttfb?: number;
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

    if (!headMark || !ttfb) {
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
  bundle_load: ({transaction, ttfb}) => {
    const span = getBundleLoadSpan(transaction);
    if (!span?.endTimestamp || !span?.startTimestamp || !ttfb) {
      return undefined;
    }
    return {
      value: (span?.endTimestamp - span?.startTimestamp) * 1000,
      unit: 'millisecond',
    };
  },
  /**
   * Experience measurement representing the time when the first "visually complete" component approximately *finishes* rendering on the page.
   * - Provided by the {@link VisuallyCompleteWithData} wrapper component.
   * - This only fires when it receives a non-empty data set for that component. Which won't capture onboarding or empty states,
   *   but most 'happy path' performance for using any product occurs only in views with data.
   * - Only record for pageload transactions
   *
   * This should replace LCP as a 'load' metric when it's present, since it also works on navigations.
   */
  visually_complete_with_data: ({transaction, ttfb, transactionStart}) => {
    const vcdSpan = getVCDSpan(transaction);
    if (!vcdSpan?.endTimestamp || !ttfb) {
      return undefined;
    }
    const value = (vcdSpan?.endTimestamp - transactionStart) * 1000;
    return {
      value,
      unit: 'millisecond',
    };
  },

  /**
   * Budget measurement for the time between loading the bundle and a visually complete component finishing it's render.
   *
   * Fires for navigation components as well using the beginning of the navigation as 'init'
   *
   * For now this is a quite broad measurement but can be roughly be broken down into:
   * - Post bundle load application initialization
   * - Http waterfalls for data
   * - Rendering of components, including the VCD component.
   */
  init_to_vcd: ({transaction, transactionOp, transactionStart}) => {
    const bundleSpan = getBundleLoadSpan(transaction);
    const vcdSpan = getVCDSpan(transaction);
    if (!vcdSpan?.endTimestamp || !['navigation', 'pageload'].includes(transactionOp)) {
      return undefined;
    }

    const startTimestamp =
      transactionOp === 'navigation' ? transactionStart : bundleSpan?.endTimestamp;
    if (!startTimestamp) {
      return undefined;
    }
    return {
      value: (vcdSpan.endTimestamp - startTimestamp) * 1000,
      unit: 'millisecond',
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

/**
 * A temporary util function used for interaction transactions that will attach a tag to the transaction, indicating the element
 * that was interacted with. This will allow for querying for transactions by a specific element. This is a high cardinality tag, but
 * it is only temporary for an experiment
 */
export const addUIElementTag = (transaction: TransactionEvent) => {
  if (!transaction || transaction.contexts?.trace?.op !== 'ui.action.click') {
    return;
  }

  if (!transaction.tags) {
    return;
  }

  const interactionSpan = transaction.spans?.find(
    span => span.op === 'ui.interaction.click'
  );

  transaction.tags.interactionElement = interactionSpan?.description;
};
