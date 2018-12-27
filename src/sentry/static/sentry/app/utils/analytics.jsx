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
