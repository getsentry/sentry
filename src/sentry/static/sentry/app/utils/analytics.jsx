import HookStore from 'app/stores/hookStore';

/**
 * If the backend for `analytics` is reload, you will need to add the event `name`
 * to the inclusion list in https://github.com/getsentry/reload/blob/master/reload_app/events.py
 *
 *
 * If you are using `gauge` or `increment`, the metric names need to be added to
 * https://github.com/getsentry/reload/blob/master/reload_app/metrics/__init__.py
 */

/**
 * @param {String} name The name of the event
 * @param {Object} data Additional event data to record
 */
export function analytics(name, data) {
  HookStore.get('analytics:event').forEach(cb => cb(name, data));
}

export function amplitude(name, organization_id, data) {
  HookStore.get('amplitude:event').forEach(cb => cb(name, organization_id, data));
}

/**
 * @param {String} name Metric name
 * @param {Number} value Value to record for this metric
 * @param {Object} tags An additional tags object
 */
export function metric(name, value, tags) {
  HookStore.get('metrics:event').forEach(cb => cb(name, value, tags));
}

// JSDOM implements window.performance but not window.performance.mark
const canMark = () =>
  window.performance &&
  typeof window.performance.mark === 'function' &&
  typeof window.performance.measure === 'function';

metric.mark = function metricMark(name) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!canMark) {
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
metric.measure = function metricMeasure({name, start, end, data, noCleanup} = {}) {
  // Just ignore if browser is old enough that it doesn't support this
  if (!canMark) {
    return;
  }

  if (!name || !start) {
    throw new Error('Invalid arguments provided to `metric.measure`');
  }

  const {measure, getEntriesByName, clearMarks, clearMeasures} = window.performance;

  measure(name, start, end);

  // Retrieve measurement entries
  getEntriesByName(name, 'measure').forEach(measurement => {
    metric(measurement.name, measurement.duration, {
      ...data,
    });
  });

  // By default, clean up marks and measurements
  if (!noCleanup) {
    clearMarks(start);
    clearMarks(end);
    clearMeasures(name);
  }
};
