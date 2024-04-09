import type moment from 'moment';

import type {Environment, Project} from 'sentry/types';

export type ThresholdQuery = {
  environment?: string[]; // list of environment names
  monitor_type?: number; // monitor type
  project?: number[]; // list of project ids
};

export type ThresholdStatusesQuery = Omit<ThresholdQuery, 'project'> & {
  end: string;
  release: string[]; // list of release versions
  start: string;
  projectSlug?: string[]; // list of project slugs
};

export type ThresholdStatus = Threshold & {
  is_healthy: boolean;
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
  end?: string;
  start?: string;
};

export type EditingThreshold = Omit<Threshold, 'environment' | 'window_in_seconds'> & {
  windowSuffix: moment.unitOfTime.DurationConstructor;
  windowValue: number;
  environmentName?: string;
  hasError?: boolean;
};
