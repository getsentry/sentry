import {Environment, Project} from 'sentry/types';

export type ThresholdQuery = {
  environment?: string[] | undefined;
  project?: number[] | undefined;
};

export type Threshold = {
  date_added: string;
  environment: Environment;
  project: Project;
  threshold_type: string;
  trigger_type: string;
  value: number;
  window_in_seconds: number;
  id?: string; // If no id, then this is a pending threshold
};
