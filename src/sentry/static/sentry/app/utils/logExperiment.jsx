import HookStore from 'app/stores/hookStore';

/**
 * @param {String} experimentName Name of the experiment
 * @param {Object} experiments Config
 * @param {Object} data Experiment data to be recorded: {unit_name, unit_id, params}
 * 					note that params need to be string
 */
export default function logExperiment(experimentName, experiments, data) {
  let assignment = experiments[experimentName];
  let param = data.params;

  if (assignment === null) return;

  data.experiment_name = experimentName;
  data.params = `{${param}: ${assignment}}`;
  HookStore.get('analytics:log-experiment').forEach(cb => cb(data));
}
