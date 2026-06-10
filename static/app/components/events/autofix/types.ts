export enum DiffFileType {
  ADDED = 'A',
  MODIFIED = 'M',
  DELETED = 'D',
}

export enum DiffLineType {
  ADDED = '+',
  REMOVED = '-',
  CONTEXT = ' ',
}

export enum AutofixStoppingPoint {
  ROOT_CAUSE = 'root_cause',
  SOLUTION = 'solution',
  CODE_CHANGES = 'code_changes',
  OPEN_PR = 'open_pr',
}

export enum CodingAgentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum CodingAgentProvider {
  CURSOR_BACKGROUND_AGENT = 'cursor_background_agent',
  CLAUDE_CODE_AGENT = 'claude_code_agent',
  GITHUB_COPILOT_AGENT = 'github_copilot_agent',
}

export type FilePatch = {
  added: number;
  hunks: Hunk[];
  path: string;
  removed: number;
  source_file: string;
  target_file: string;
  type: DiffFileType;
};

type Hunk = {
  lines: DiffLine[];
  section_header: string;
  source_length: number;
  source_start: number;
  target_length: number;
  target_start: number;
};

export type DiffLine = {
  diff_line_no: number | null;
  line_type: DiffLineType;
  source_line_no: number | null;
  target_line_no: number | null;
  value: string;
};

export interface AutofixRepoDefinition {
  name: string;
  owner: string;
  provider: string;
}

export interface BranchOverride {
  branch_name: string;
  tag_name: string;
  tag_value: string;
}

export interface RepoSettings {
  branch: string;
  branch_overrides: BranchOverride[];
  instructions: string;
}

export interface SeerRepoDefinition {
  external_id: string;
  name: string;
  owner: string;
  provider: string;
  base_commit_sha?: string;
  branch_name?: string;
  branch_overrides?: BranchOverride[];
  instructions?: string;
  integration_id?: string;
  organization_id?: number | string; // TODO: should be string
  provider_raw?: string;
}

export interface SeerAutomationHandoffConfiguration {
  handoff_point: 'root_cause';
  integration_id: number;
  target: CodingAgentProvider;
  auto_create_pr?: boolean;
}

export interface ProjectSeerPreferences {
  repositories: SeerRepoDefinition[];
  automated_run_stopping_point?: 'root_cause' | 'solution' | 'code_changes' | 'open_pr';
  automation_handoff?: SeerAutomationHandoffConfiguration;
}
