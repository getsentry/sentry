import HookStore from 'app/stores/hookStore';

/**
 * @param {Object} data Experiment data to be recorded: {experiment_name, unit_name, unit_id, params}
 */
export default function log_exposure(data) {
  HookStore.get('analytics:log-experiment').forEach(cb => cb(data));
}
