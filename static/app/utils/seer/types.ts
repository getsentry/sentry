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

export type AgentIntegration = {
  id: string | null;
  name: string;
  provider: CodingAgentProvider;
  has_identity?: boolean;
  requires_identity?: boolean;
};

// Mirrors python enum: AutomationCodingAgent
export type PreferredAgentProvider =
  | 'seer'
  | CodingAgentProvider.CURSOR_BACKGROUND_AGENT
  | CodingAgentProvider.CLAUDE_CODE_AGENT;

export type AutofixAgentSelectOption = 'seer' | `${CodingAgentProvider}::${string}`;

// Mirrors python serializer: ProjectSettingsUpdateSerializer
export type SeerProjectSettingUpdatePayload = {
  agentOption?: AutofixAgentSelectOption;
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
  agent: PreferredAgentProvider;
  autoCreatePr: boolean | null;
  automationTuning: InternalAutomationTuning;
  integrationId: string | null;
  projectId: string;
  projectSlug: string;
  reposCount: number;
  scannerAutomation: boolean;
  stoppingPoint: SeerAutofixStoppingPoint;
};
