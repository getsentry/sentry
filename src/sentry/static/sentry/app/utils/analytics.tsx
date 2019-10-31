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
 * Legacy analytics tracking.
 *
 * @deprecated Prefer `trackAnalyticsEvent` and `trackAdhocEvent`.
 */
export const analytics: Hooks['analytics:event'] = (name, data) =>
  HookStore.get('analytics:event').forEach(cb => cb(name, data));

type RecordMetric = Hooks['metrics:event'] & {
  mark: (name: string) => void;

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
     * Additional data to send with metric event
     */
    data?: object;
    /**
     * Do not clean up marks and measurements when completed
     */
    noCleanup?: boolean;
  }) => void;
};

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

metric.mark = function metricMark(name) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  window.performance.mark(name);
};

/**
 * Performs a measurement between `start` and `end` (or now if `end` is not
 * specified) Calls `metric` with `name` and the measured time difference.
 */
metric.measure = function metricMeasure({name, start, end, data, noCleanup} = {}) {
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

  // Retrieve measurement entries
  performance
    .getEntriesByName(name, 'measure')
    .forEach(measurement => metric(measurement.name, measurement.duration, data));

  // By default, clean up measurements
  if (!noCleanup) {
    performance.clearMeasures(name);
    performance.clearMarks(start);
    performance.clearMarks(endMarkName);
  }
};
