import {Experiments, ExperimentType} from 'app/types/experiments';

/**
 * This is the value an experiment will have when the unit of assignment
 * (organization, user, etc) is not part of any experiment group.
 *
 * This likely indicates they should see nothing, or the original version of
 * what's being tested.
 */
export const unassignedValue = -1;

/**
 * Frontend experiment configuration object
 */
export const experimentList = [
  {
    key: 'IntegrationDirectoryCategoryExperiment',
    type: ExperimentType.Organization,
    parameter: 'variant',
    assignments: ['0', '1'],
  },
  {
    key: 'TrialEndingNotice',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
] as const;

export const experimentConfig = experimentList.reduce(
  (acc, exp) => ({...acc, [exp.key]: exp}),
  {}
) as Experiments;
