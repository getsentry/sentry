import HookStore from 'app/stores/hookStore';

/**
 * If the backend for `analytics` is reload, you will need to add the event `name`
 * to the inclusion list in https://github.com/getsentry/reload/blob/master/reload_app/events.py
 *
 * @param {String} name The name of the event
 * @param {Object} data Additional event data to record
 */
function analytics(name, data) {
  HookStore.get('analytics:event').forEach(cb => cb(name, data));
}

function amplitude(name, organization_id, data) {
  HookStore.get('amplitude:event').forEach(cb => cb(name, organization_id, data));
}

export {amplitude, analytics};
