import * as Sentry from '@sentry/react';

import HookStore from 'app/stores/hookStore';
import {Hooks} from 'app/types/hooks';

/**
 * Analytics and metric tracking functionality.
 *
 * These are primarily driven through hooks provided through the hookstore. For
 * sentry.io these are currently mapped to our in-house analytics backend
 * 'Reload' and the Amplitude service.
 *
 * NOTE: sentry.io contributors, you will need to nesure that the eventKey
 *       passed exists as an event key in the Reload events.py configuration:
 *
 *       https://github.com/getsentry/reload/blob/master/reload_app/events.py
 *
 * NOTE: sentry.io contributors, if you are using `gauge` or `increment` the
 *       name must be added to the Reload metrics module:
 *
 *       https://github.com/getsentry/reload/blob/master/reload_app/metrics/__init__.py
 */

/**
 * This should be primarily used for product events. In that case where you
 * want to track some one-off Adhoc events, use the `trackAdhocEvent` function.
 *
 * Generally this is the function you will want to use for event tracking.
 *
 * Refer for the backend implementation provided through HookStore for more
 * details.
 */
export const trackAnalyticsEvent: Hooks['analytics:track-event'] = options =>
  HookStore.get('analytics:track-event').forEach(cb => cb(options));

/**
 * This should be used for adhoc analytics tracking.
 *
 * This is used for high volume events, and events with unbounded parameters,
 * such as tracking search queries.
 *
 * Refer for the backend implementation provided through HookStore for a more
 * thorough explanation of when to use this.
 */
export const trackAdhocEvent: Hooks['analytics:track-adhoc-event'] = options =>
  HookStore.get('analytics:track-adhoc-event').forEach(cb => cb(options));

/**
 * This should be used to log when a `organization.experiments` experiment
 * variant is checked in the application.
 *
 * Refer for the backend implementation provided through HookStore for more
 * details.
 */
export const logExperiment: Hooks['analytics:log-experiment'] = options =>
  HookStore.get('analytics:log-experiment').forEach(cb => cb(options));

/**
 * Helper function for `trackAnalyticsEvent` to generically track usage of deprecated features
 *
 * @param feature A name to identify the feature you are tracking
 * @param orgId The organization id
 * @param url [optional] The URL
 */
export const trackDeprecated = (feature: string, orgId: number, url: string = '') =>
  trackAdhocEvent({
    eventKey: 'deprecated.feature',
    feature,
    url,
    org_id: orgId && Number(orgId),
  });

/**
 * Legacy analytics tracking.
 *
 * @deprecated Prefer `trackAnalyticsEvent` and `trackAdhocEvent`.
 */
export const analytics: Hooks['analytics:event'] = (name, data) =>
  HookStore.get('analytics:event').forEach(cb => cb(name, data));

type RecordMetric = Hooks['metrics:event'] & {
  mark: (opts: {
    /**
     * Name of the metric event
     */
    name: string;
    /**
     * Additional data that will be sent with measure()
     * This is useful if you want to track initial state
     */
    data?: object;
  }) => void;

  measure: (opts: {
    /**
     * Name of the metric event
     */
    name?: string;
    /**
     * Name of starting mark
     */
    start?: string;
    /**
     * Name of ending mark
     */
    end?: string;
    /**
     * Additional data to send with metric event.
     * If a key collide with the data in mark(), this will overwrite them
     */
    data?: object;
    /**
     * Do not clean up marks and measurements when completed
     */
    noCleanup?: boolean;
  }) => void;

  startTransaction: (opts: {
    /**
     * Name of transaction
     */
    name: string;
    /**
     * Optional trace id, defaults to current tx trace
     */
    traceId?: string;
    /**
     * Optional op code
     */
    op?: string;
  }) => void;

  endTransaction: (opts: {
    /**
     * Name of the transaction to end
     */
    name: string;
  }) => void;
};

/**
 * Used to pass data between metric.mark() and metric.measure()
 */
const metricDataStore = new Map<string, object>();

/**
 * Record metrics.
 */
export const metric: RecordMetric = (name, value, tags) =>
  HookStore.get('metrics:event').forEach(cb => cb(name, value, tags));

// JSDOM implements window.performance but not window.performance.mark
const CAN_MARK =
  window.performance &&
  typeof window.performance.mark === 'function' &&
  typeof window.performance.measure === 'function' &&
  typeof window.performance.getEntriesByName === 'function' &&
  typeof window.performance.clearMeasures === 'function';

metric.mark = function metricMark({name, data = {}}) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  if (!name) {
    throw new Error('Invalid argument provided to `metric.mark`');
  }

  window.performance.mark(name);
  metricDataStore.set(name, data);
};

/**
 * Performs a measurement between `start` and `end` (or now if `end` is not
 * specified) Calls `metric` with `name` and the measured time difference.
 */
metric.measure = function metricMeasure({name, start, end, data = {}, noCleanup} = {}) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  if (!name || !start) {
    throw new Error('Invalid arguments provided to `metric.measure`');
  }

  let endMarkName = end;

  // Can't destructure from performance
  const {performance} = window;

  // NOTE: Edge REQUIRES an end mark if it is given a start mark
  // If we don't have an end mark, create one now.
  if (!end) {
    endMarkName = `${start}-end`;
    performance.mark(endMarkName);
  }

  // Check if starting mark exists
  if (!performance.getEntriesByName(start, 'mark').length) {
    return;
  }

  performance.measure(name, start, endMarkName);
  const startData = metricDataStore.get(start) || {};

  // Retrieve measurement entries
  performance
    .getEntriesByName(name, 'measure')
    .forEach(measurement =>
      metric(measurement.name, measurement.duration, {...startData, ...data})
    );

  // By default, clean up measurements
  if (!noCleanup) {
    performance.clearMeasures(name);
    performance.clearMarks(start);
    performance.clearMarks(endMarkName);
    metricDataStore.delete(start);
  }
};

/**
 * Used to pass data between startTransaction and endTransaction
 */
const transactionDataStore = new Map<string, object>();

const getCurrentTransaction = () => {
  return Sentry.getCurrentHub()
    .getScope()
    ?.getTransaction();
};

metric.startTransaction = ({name, traceId, op}) => {
  if (!traceId) {
    traceId = getCurrentTransaction()?.traceId;
  }
  const transaction = Sentry.startTransaction({name, op, traceId});
  transactionDataStore[name] = transaction;
};

metric.endTransaction = ({name}) => {
  const transaction = transactionDataStore[name];
  if (transaction) {
    transaction.finish();
  }
};
