import HookStore from 'app/stores/hookStore';

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
 *
 * @param {Object} options Event tracking options
 * @param {String} options.eventKey The string key of the event to track
 * @param {String} options.name The human readable string name of the event
 * @param {...Object} options.data The parameters of the event to track
 */
export const trackAnalyticsEvent = options =>
  HookStore.get('analytics:track-event').forEach(cb => cb(options));

/**
 * This should be used for adhoc analytics tracking.
 *
 * This is used for high volume events, and events with unbounded parameters,
 * such as tracking search queries.
 *
 * Refer for the backend implementation provided through HookStore for a more
 * thorough explanation of when to use this.
 *
 * @param {Object} options Event tracking options
 * @param {String} options.eventKey The string key of the event to track
 * @param {...Object} options.data The parameters of the event to track
 */
export const trackAdhocEvent = (options: {[key: string]: any}) =>
  HookStore.get('analytics:track-adhoc-event').forEach(cb => cb(options));

/**
 * @param {String} name The name of the event
 * @param {Object} data Additional event data to record
 */
export const analytics = (
  name: string,
  data: {[key: string]: number | string | boolean}
): void => HookStore.get('analytics:event').forEach(cb => cb(name, data));

/**
 * @param {String} name Metric name
 * @param {Number} value Value to record for this metric
 * @param {Object} tags An additional tags object
 */
export const metric = (name: string, value: number, tags?: object): void =>
  HookStore.get('metrics:event').forEach(cb => cb(name, value, tags));

// JSDOM implements window.performance but not window.performance.mark
const CAN_MARK =
  window.performance &&
  typeof window.performance.mark === 'function' &&
  typeof window.performance.measure === 'function' &&
  typeof window.performance.getEntriesByName === 'function' &&
  typeof window.performance.clearMeasures === 'function';

metric.mark = function metricMark(name: string): void {
  // Just ignore if browser is old enough that it doesn't support this
  if (!CAN_MARK) {
    return;
  }

  window.performance.mark(name);
};

/**
 * Performs a measurement between `start` and `end` (or now if `end` is not specified)
 * Calls `metric` with `name` and the measured time difference.
 *
 * @param {Object} options keyword args object
 * @param {String} options.name Name of the metric event
 * @param {String} options.start Name of starting mark
 * @param {String} options.end (optional) Name of ending mark
 * @param {Boolean} options.noCleanup Do not clean up marks and measurements when completed
 * @param {Object} options.data (optional) Additional data to send with metric event
 */
metric.measure = function metricMeasure({
  name,
  start,
  end,
  data,
  noCleanup,
}: {
  name?: string;
  start?: string;
  end?: string;
  data?: object;
  noCleanup?: boolean;
} = {}): void {
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
