import HookStore from 'app/stores/hookStore';

/**
 * @param {Object} experiments: Config
 * @param {String} param: assignment parameter, e.g. "color"
 */
export default function logExperiment(
  experiments,
  experimentName,
  unitName,
  unitId,
  param
) {
  let assignment = experiments[experimentName];
  if (assignment === null || assignment === undefined) return;

  let data = {
    experiment_name: experimentName,
    unit_name: unitName,
    unit_id: unitId,
    params: {
      [param]: assignment,
    },
  };
  HookStore.get('analytics:log-experiment').forEach(cb => cb(data));
}
