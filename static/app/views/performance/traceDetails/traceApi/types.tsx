import type {Level} from 'sentry/types/event';

export type TraceError = {
  event_id: string;
  issue: string;
  issue_id: number;
  level: Level;
  message: string;
  project_id: number;
  project_slug: string;
  span: string;
  title: string;
  event_type?: string;
  generation?: number;
  timestamp?: number;
  type?: number;
};

export type TracePerformanceIssue = Omit<TraceError, 'issue' | 'span'> & {
  culprit: string;
  end: number;
  span: string[];
  start: number;
  suspect_spans: string[];
  type: number;
  issue_short_id?: string;
};

export type EAPTraceMeta = {
  errorsCount: number;
  logsCount: number;
  metricsCount: number;
  performanceIssuesCount: number;
  spansCount: number;
  spansCountMap: Record<string, number>;
  uptimeCount: number;
};

export type ResponseEAPTraceMeta = {
  errorsCount: number;
  logsCount: number;
  metricsCount: number;
  performanceIssuesCount: number;
  spansCount: number;
  spansCountMap: Record<string, number>;
  uptimeCount?: number;
};
