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

export type EditingThreshold = {
  id: string;
  project: Project;
  threshold_type: string;
  trigger_type: string;
  value: number;
  windowSuffix: moment.unitOfTime.DurationConstructor;
  windowValue: number;
  date_added?: string;
  environment?: string;
  hasError?: boolean;
  window_in_seconds?: number;
};

export type NewThresholdGroup = {
  environments: string[];
  id: string;
  project: Project;
};
