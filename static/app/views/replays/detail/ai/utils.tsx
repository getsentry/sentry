import {t} from 'sentry/locale';

export const NO_REPLAY_SUMMARY_MESSAGES = [
  t('Quiet moment here — nothing too wild happening in this replay.'),
  t('Looks like a peaceful little replay!'),
  t('Just a calm moment in the timeline.'),
  t('This replay is taking it easy.'),
  t('Not a lot happening here — maybe a coffee break?'),
  t('All quiet on the replay front.'),
];

export enum ReplaySummaryStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
  NOT_STARTED = 'not_started',
}

export enum ReplaySummaryTemp {
  MIN = 0,
  LOW = 0.2,
  MED = 0.5,
  HIGH = 0.8,
  MAX = 1,
}

export interface SummaryResponse {
  created_at: string | null;
  data: {
    summary: string;
    time_ranges: TimeRanges;
  } | null;
  num_segments: number | null;
  status: ReplaySummaryStatus;
}

export type TimeRanges = Array<{
  period_end: number;
  period_start: number;
  period_title: string;
}>;
