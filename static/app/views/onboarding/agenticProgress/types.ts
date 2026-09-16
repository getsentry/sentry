type AgenticProgressStage =
  | 'connect_mcp'
  | 'analyze_project'
  | 'create_project'
  | 'instrument_app'
  | 'plan_test_error'
  | 'send_verification_error'
  | 'receive_verification_error'
  | 'prepare_production'
  | 'check_stack_trace_quality';

type AgenticProgressStageStatus =
  | 'active'
  | 'waiting'
  | 'completed'
  | 'skipped'
  | 'bypassed'
  | 'failed';

type AgenticProgressRunStatus = 'active' | 'completed' | 'failed' | 'cancelled';

type Stage<
  Key extends AgenticProgressStage,
  Extra extends Record<string, unknown> | null = null,
> = {
  eventNote: string | null;
  extra: Extra;
  stage: Key;
  status: AgenticProgressStageStatus | null;
};

type AgenticProgressStageState =
  | Stage<'create_project', {projectSlugs: string[]} | null>
  | Stage<'receive_verification_error', {issueIds: string[]} | null>
  | Stage<Exclude<AgenticProgressStage, 'create_project' | 'receive_verification_error'>>;

export type AgenticProgressRun = {
  channelId: string;
  clientRunId: string;
  continueUpdates: boolean;
  createdAt: string;
  expiresAt: string;
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
