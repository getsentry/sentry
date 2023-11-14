import moment from 'moment';

import {Environment, Project} from 'sentry/types';

export type ThresholdQuery = {
  environment?: string[] | undefined;
  project?: number[] | undefined;
};

export type Threshold = {
  environment: Environment;
  id: string;
  project: Project;
  threshold_type: string;
  trigger_type: 'over' | 'under';
  value: number;
  window_in_seconds: number;
  date_added?: string;
};

export type EditingThreshold = Omit<Threshold, 'environment' | 'window_in_seconds'> & {
  windowSuffix: moment.unitOfTime.DurationConstructor;
  windowValue: number;
  environmentName?: string;
  hasError?: boolean;
};
