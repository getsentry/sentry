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

type BranchOverrideInput = {
  branchName: string;
  tagName: string;
  tagValue: string;
};

export type SeerProjectRepoCreateInput = {
  repositoryId: string;
  branchName?: string | null;
  branchOverrides?: BranchOverrideInput[];
  instructions?: string | null;
};

export type SeerProjectMutateRepoPayload = {
  branchName?: string | null;
  branchOverrides?: BranchOverrideInput[];
  instructions?: string | null;
};

export type SeerProjectReposResponse = {
  branchName: string;
  branchOverrides: Array<{
    branchName: string;
    id: string;
    tagName: string;
    tagValue: string;
  }>;
  externalId: string;
  id: string;
  instructions: string;
  integrationId: string;
  name: string;
  organizationId: string;
  owner: string;
  provider: string;
  repositoryId: string;
};
