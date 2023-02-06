import {Experiments, ExperimentType} from 'sentry/types/experiments';
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
export const experimentList: {
  assignments: number[];
  key: string;
  parameter: string;
  type: ExperimentType;
}[] = [
  {
    key: 'SavedIssueSearchesLocationExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
];

export const experimentConfig = experimentList.reduce(
  (acc, exp) => ({...acc, [exp.key]: exp}),
  {}
) as Experiments;
