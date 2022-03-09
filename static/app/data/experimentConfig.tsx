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
    key: 'HighlightTrialOnSignupExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposure_scenario',
    assignments: ['none', 'on_signup', 'on_first_event'],
  },
  {
    key: 'SubscriptionMemberViewExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
  {
    key: 'ContactSalesOnCheckoutExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
  {
    key: 'TargetedFeaturesOnCheckoutExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
  {
    key: 'TrialTagsOnCheckoutExperiment',
    type: ExperimentType.Organization,
    parameter: 'exposed',
    assignments: [0, 1],
  },
] as const;

export const experimentConfig = experimentList.reduce(
  (acc, exp) => ({...acc, [exp.key]: exp}),
  {}
) as Experiments;
