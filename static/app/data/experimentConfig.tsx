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
export const experimentList = [
  {
    key: 'OnboardingNewFooterExperiment',
    type: ExperimentType.Organization,
    parameter: 'scenario',
    assignments: ['baseline', 'variant1', 'variant2'],
  },
  {
    key: 'ExtendTrialByInvitingMemberExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
  {
    key: 'ProjectCreationForAllExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
] as const;

export const experimentConfig = experimentList.reduce(
  (acc, exp) => ({...acc, [exp.key]: exp}),
  {}
) as Experiments;
