import type {CodingAgentProvider} from 'sentry/components/events/autofix/types';

export type InternalAutomationTuning =
  | 'off'
  | 'super_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'always';

type UserFacingAutomationTuning = 'off' | 'medium';

export type SeerAutofixStoppingPoint =
  | 'off' // Set automationTuning to 'off' to represent this
  | 'root_cause'
  | 'solution' // aka 'Plan'
  | 'code_changes' // collapsed into 'open_pr'
  | 'open_pr'; // aka 'Create PR'

export type UserFacingStoppingPoint = 'off' | 'root_cause' | 'plan' | 'create_pr';

// Mirrors python enum: AutomationCodingAgent
export type SeerAgent =
  | 'seer'
  | CodingAgentProvider.CURSOR_BACKGROUND_AGENT
  | CodingAgentProvider.CLAUDE_CODE_AGENT;

// type SeerAutomationHandoffConfiguration = {
//   auto_create_pr: boolean;
//   handoff_point: 'root_cause';
//   integration_id: string;
//   target:
//     | CodingAgentProvider.CURSOR_BACKGROUND_AGENT
//     | CodingAgentProvider.CLAUDE_CODE_AGENT;
// };

// type SeerProjectSetting = {
//   agent: SeerAgent;
//   automation_tuning: InternalAutomationTuning;
//   handoff: SeerAutomationHandoffConfiguration | null;
//   repos_count: number;
//   scanner_automation: boolean;
//   stopping_point: UserFacingStoppingPoint;
// };

// Mirrors python serializer: ProjectSettingsUpdateSerializer
export type SeerProjectSettingUpdatePayload = {
  agent?: SeerAgent;
  automationTuning?: UserFacingAutomationTuning;
  integrationId?: string;
  scannerAutomation?: boolean;
  stoppingPoint?: SeerAutofixStoppingPoint; // SeerAutofixStoppingPoint;
};

// Mirrors python serializer: BulkProjectSettingsUpdateSerializer
export type SeerBulkProjectSettingUpdatePayload = {
  query?: string;
} & SeerProjectSettingUpdatePayload;

export type SeerProjectSettingResponse = {
  agent: SeerAgent;
  autoCreatePr: boolean | null;
  automationTuning: InternalAutomationTuning;
  integrationId: string | null;
  projectId: string;
  projectSlug: string;
  reposCount: number;
  scannerAutomation: boolean;
  stoppingPoint: SeerAutofixStoppingPoint;
};
