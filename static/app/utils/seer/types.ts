export type InternalAutomationTuning =
  | 'off'
  | 'super_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'always';

export type UserFacingAutomationTuning = 'off' | 'medium';

export type InternalStoppingPoint =
  | 'off'
  | 'root_cause'
  | 'solution'
  | 'code_changes'
  | 'open_pr';

export type UserFacingStoppingPoint = 'off' | 'root_cause' | 'plan' | 'create_pr';

export type SeerAgent = 'seer' | 'cursor_background_agent' | 'claude_code_agent';

type SeerAutomationHandoffConfiguration = {
  auto_create_pr: boolean;
  handoff_point: 'root_cause';
  integration_id: number;
  target: 'cursor_background_agent' | 'claude_code_agent';
};

export type SeerProjectSetting = {
  agent: SeerAgent;
  automation_tuning: InternalAutomationTuning;
  handoff: SeerAutomationHandoffConfiguration | null;
  repos_count: number;
  scanner_automation: boolean;
  stopping_point: UserFacingStoppingPoint;
};

export type SeerProjectSettingUpdate = {
  agent?: SeerAgent;
  scannerAutomation?: boolean;
  stoppingPoint?: UserFacingStoppingPoint;
};

export type SeerProjectSettingResponse = {
  agent: SeerAgent;
  autoCreatePr: boolean | null;
  automationTuning: InternalAutomationTuning;
  integrationId: string | null;
  projectId: string;
  projectSlug: string;
  reposCount: number;
  scannerAutomation: boolean;
  stoppingPoint: InternalStoppingPoint;
};
