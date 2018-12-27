import HookStore from 'app/stores/hookStore';

/**
 * Note, you will need to add the event `name` to the inclusion list in redash
 * See: https://github.com/getsentry/reload/blob/master/reload_app/app.py#L20
 *
 * @param {String} name The name of the event
 * @param {Object} data Additional event data to record
 */
export default function analytics(name, data) {
  HookStore.get('analytics:event').forEach(cb => cb(name, data));
}
