import type {TimeseriesValue} from 'sentry/types/coreBase';

export type SeerNightshiftTweaks = {
  enabled?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
};
export type ProjectStats = TimeseriesValue[];
// Response from project_keys endpoints.
export type ProjectKey = {
  browserSdk: {
    choices: Array<[key: string, value: string]>;
  };
  browserSdkVersion: ProjectKey['browserSdk']['choices'][number][0];
  dateCreated: string;
  dsn: {
    cdn: string;
    crons: string;
    csp: string;
    integration: string;
    minidump: string;
    otlp_logs: string;
    otlp_traces: string;
    playstation: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasFeedback: boolean;
    hasLogsAndMetrics: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string;
  useCase?: string;
};
export type Environment = {
  displayName: string;
  id: string;
  name: string;
};
