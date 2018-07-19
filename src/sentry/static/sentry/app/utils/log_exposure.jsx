import HookStore from 'app/stores/hookStore';

/**
 * @param {String} name name of the experiment
 * @param {Object} data Experiment data to be recorded: {unit_name, unit_id, params}
 * 					note that params need to string
 */
export default function log_exposure(name, data) {
	data.experiment_name = name;
	HookStore.get('analytics:log-exposure').forEach(cb => cb(data));
}
