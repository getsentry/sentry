import type {EventMetadata} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {User} from 'sentry/types/user';

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

export enum AutofixStepType {
  DEFAULT = 'default',
  ROOT_CAUSE_ANALYSIS = 'root_cause_analysis',
  CHANGES = 'changes',
  SOLUTION = 'solution',
}

export enum AutofixStatus {
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  PROCESSING = 'PROCESSING',
  NEED_MORE_INFORMATION = 'NEED_MORE_INFORMATION',
  CANCELLED = 'CANCELLED',
  WAITING_FOR_USER_RESPONSE = 'WAITING_FOR_USER_RESPONSE',
}

export enum AutofixStoppingPoint {
  ROOT_CAUSE = 'root_cause',
  SOLUTION = 'solution',
  CODE_CHANGES = 'code_changes',
  OPEN_PR = 'open_pr',
}

type AutofixPullRequestDetails = {
  pr_number: number;
  pr_url: string;
};

type AutofixOptions = {
  iterative_feedback?: boolean;
};

interface CodingAgentResult {
  branch_name: string | null;
  description: string;
  pr_url: string | null;
  repo_full_name: string;
  repo_provider: string;
}

export enum CodingAgentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum CodingAgentProvider {
  CURSOR_BACKGROUND_AGENT = 'cursor_background_agent',
}

export interface CodingAgentState {
  id: string;
  name: string;
  provider: CodingAgentProvider;
  started_at: string;
  status: CodingAgentStatus;
  agent_url?: string;
  results?: CodingAgentResult[];
}

type CodebaseState = {
  is_readable: boolean | null;
  is_writeable: boolean | null;
  repo_external_id: string | null;
};

export type AutofixData = {
  codebases: Record<string, CodebaseState>;
  last_triggered_at: string;
  request: {
    repos: SeerRepoDefinition[];
    options?: {
      auto_run_source?: string | null;
    };
  };
  run_id: string;
  status: AutofixStatus;
  actor_ids?: number[];
  codebase_indexing?: {
    status: 'COMPLETED';
  };
  coding_agents?: Record<string, CodingAgentState>;
  completed_at?: string | null;
  error_message?: string;
  options?: AutofixOptions;
  steps?: AutofixStep[];
  users?: Record<number, User>;
};

export type AutofixProgressItem = {
  message: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'NEED_MORE_INFORMATION';
  data?: any;
};

export type AutofixStep =
  | AutofixDefaultStep
  | AutofixRootCauseStep
  | AutofixSolutionStep
  | AutofixChangesStep;

interface BaseStep {
  id: string;
  index: number;
  progress: AutofixProgressItem[];
  status: AutofixStatus;
  title: string;
  type: AutofixStepType;
  active_comment_thread?: CommentThread | null;
  agent_comment_thread?: CommentThread | null;
  completedMessage?: string;
  key?: string;
  output_stream?: string | null;
}

export type CommentThread = {
  id: string;
  is_completed: boolean;
  messages: CommentThreadMessage[];
};

export interface CommentThreadMessage {
  content: string;
  role: 'user' | 'assistant';
  isLoading?: boolean;
}

export type AutofixInsight = {
  insight: string;
  justification: string;
  change_diff?: FilePatch[];
  markdown_snippets?: string;
  sources?: InsightSources;
  type?: 'insight' | 'file_change';
};

export type InsightSources = {
  breadcrumbs_used: boolean;
  code_used_urls: string[];
  connected_error_ids_used: string[];
  diff_urls: string[];
  http_request_used: boolean;
  profile_ids_used: string[];
  stacktrace_used: boolean;
  thoughts: string;
  trace_event_ids_used: string[];
  event_trace_id?: string;
  event_trace_timestamp?: number;
};

export interface AutofixDefaultStep extends BaseStep {
  insights: AutofixInsight[];
  type: AutofixStepType.DEFAULT;
}

export type AutofixRootCauseSelection =
  | {
      cause_id: string;
    }
  | {custom_root_cause: string}
  | null;

export interface AutofixRootCauseStep extends BaseStep {
  causes: AutofixRootCauseData[];
  selection: AutofixRootCauseSelection;
  type: AutofixStepType.ROOT_CAUSE_ANALYSIS;
  termination_reason?: string;
}

export interface AutofixSolutionStep extends BaseStep {
  solution: AutofixSolutionTimelineEvent[];
  solution_selected: boolean;
  type: AutofixStepType.SOLUTION;
  custom_solution?: string;
  description?: string;
}

export type AutofixCodebaseChange = {
  description: string;
  diff: FilePatch[];
  repo_name: string;
  title: string;
  branch_name?: string;
  diff_str?: string;
  pull_request?: AutofixPullRequestDetails;
  repo_external_id?: string;
  repo_id?: number; // The repo_id is only here for temporary backwards compatibility for LA customers, and we should remove it soon. Use repo_external_id instead.
};

export interface AutofixChangesStep extends BaseStep {
  changes: AutofixCodebaseChange[];
  type: AutofixStepType.CHANGES;
  termination_reason?: string;
}

type AutofixRelevantCodeFile = {
  file_path: string;
  repo_name: string;
};

type AutofixRelevantCodeFileWithUrl = AutofixRelevantCodeFile & {
  url?: string;
};

export type AutofixTimelineEvent = {
  code_snippet_and_analysis: string;
  relevant_code_file: AutofixRelevantCodeFile;
  timeline_item_type: 'internal_code' | 'external_system' | 'human_action';
  title: string;
  is_most_important_event?: boolean;
};

export type AutofixSolutionTimelineEvent = {
  timeline_item_type: 'internal_code' | 'human_instruction';
  title: string;
  code_snippet_and_analysis?: string;
  is_active?: boolean;
  is_most_important_event?: boolean;
  relevant_code_file?: AutofixRelevantCodeFileWithUrl;
};

export type AutofixRootCauseData = {
  id: string;
  description?: string;
  reproduction_urls?: Array<string | null>;
  root_cause_reproduction?: AutofixTimelineEvent[];
};

type EventMetadataWithAutofix = EventMetadata & {
  autofix?: AutofixData;
};

export type GroupWithAutofix = Group & {
  metadata?: EventMetadataWithAutofix;
};

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

interface SeerAutomationHandoffConfiguration {
  handoff_point: 'root_cause';
  integration_id: number;
  target: 'cursor_background_agent';
  auto_create_pr?: boolean;
}

export interface ProjectSeerPreferences {
  repositories: SeerRepoDefinition[];
  automated_run_stopping_point?:
    | 'root_cause'
    | 'solution'
    | 'code_changes'
    | 'open_pr'
    | 'background_agent';
  automation_handoff?: SeerAutomationHandoffConfiguration;
}

export const AUTOFIX_TTL_IN_DAYS = 30;
