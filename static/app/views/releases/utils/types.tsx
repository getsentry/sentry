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
  trigger_type: string; // 'over' or 'under'
  value: number;
  window_in_seconds: number;
  date_added?: string;
};
