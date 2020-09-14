import {Project} from 'app/types';

export type Status = 'ok' | 'error';

export type Monitor = {
  status: Status;
  project: Project;
  name: string;
  lastCheckIn: string;
  config: {
    checkin_margin: number;
    schedule_type: 'interval' | 'crontab';
    max_runtime: number;
    schedule: unknown[];
  };
  nextCheckIn: string;
  type: 'cron_job';
  id: string;
  dateCreated: string;
};
