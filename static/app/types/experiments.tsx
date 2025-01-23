import type {experimentList, unassignedValue} from 'sentry/data/experimentConfig';

/**
 * The grouping of the experiment
 */
export enum ExperimentType {
  ORGANIZATION = 'organization',
  USER = 'user',
}

/**
 * An experiment configuration object defines an experiment in the frontend.
 * This drives various logic in experiment helpers.
 */
export type ExperimentConfig = {
  /**
   * Possible assignment values of the experiment
   */
  assignments: readonly (string | number | typeof unassignedValue)[];
  /**
   * The name of the organization. This maps to the key exposed by the
   * organization manager on the backend.
   */
  key: string;
  /**
   * The parameter used to access the assignment value
   */
  parameter: string | 'variant' | 'exposed';
  /**
   * The type of experiment. This configures what group the experiment is
   * performed on.
   *
   * A Organization experiment assigns the whole organization.
   * A User experiment assigns a single user.
   */
  type: ExperimentType;
};

// NOTE: The code below is mostly type mechanics to provide utility types
// around experiments for use in experiment helpers. You probably don't need to
// modify this and likely just need to make changes to the experiment list [0]
//
// [0]: app/data/experimentConfig.tsx

type ExperimentList = (typeof experimentList)[number];

type ExperimentSelect<
  C extends ExperimentConfig,
  N extends ExperimentConfig['key'],
> = C extends {key: N} ? C : never;

type TypeSelect<
  C extends ExperimentConfig,
  T extends ExperimentConfig['type'],
> = C extends {type: T} ? C : never;

/**
 * A mapping of experiment key to the experiment configuration.
 */
export type Experiments = {
  [E in ExperimentList['key']]: ExperimentSelect<ExperimentList, E>;
};

/**
 * Represents an active experiment key
 */
export type ExperimentKey = keyof Experiments;

type GetExperimentAssignment<E extends ExperimentList['key']> = {
  [K in E]: Experiments[K]['assignments'][number];
};

export type OrgExperiments = GetExperimentAssignment<
  TypeSelect<ExperimentList, ExperimentType.ORGANIZATION>['key']
>;

export type UserExperiments = GetExperimentAssignment<
  TypeSelect<ExperimentList, ExperimentType.USER>['key']
>;

export type ExperimentAssignment = GetExperimentAssignment<ExperimentList['key']>;
