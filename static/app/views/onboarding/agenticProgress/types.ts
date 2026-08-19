export type AgenticProgressStage =
  | 'connect_mcp'
  | 'analyze_project'
  | 'create_project'
  | 'instrument_app'
  | 'plan_test_error'
  | 'send_verification_error'
  | 'receive_verification_error'
  | 'prepare_production'
  | 'check_stack_trace_quality';

export type AgenticProgressStageStatus =
  | 'active'
  | 'waiting'
  | 'completed'
  | 'skipped'
  | 'bypassed'
  | 'failed';

export type AgenticProgressRunStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export type AgenticProgressStageState = {
  eventNote: string | null;
  stage: AgenticProgressStage;
  status: AgenticProgressStageStatus | null;
};

export type AgenticProgressRun = {
  channelId: string;
  clientRunId: string;
  continueUpdates: boolean;
  createdAt: string;
  expiresAt: string;
  issueIds: string[];
  projectSlugs: string[];
  runId: string;
  runStatus: AgenticProgressRunStatus;
  schemaVersion: number;
  sequence: number;
  stages: AgenticProgressStageState[];
  updatedAt: string;
  onboardingCode?: string;
};

export type InitializedAgenticProgressRun = AgenticProgressRun & {
  onboardingCode: string;
};
