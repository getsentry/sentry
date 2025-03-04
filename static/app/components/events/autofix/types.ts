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

export enum AutofixCodebaseIndexingStatus {
  UP_TO_DATE = 'up_to_date',
  INDEXING = 'indexing',
  NOT_INDEXED = 'not_indexed',
  OUT_OF_DATE = 'out_of_date',
  ERRORED = 'errored',
}

export enum AutofixStatus {
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  PROCESSING = 'PROCESSING',
  NEED_MORE_INFORMATION = 'NEED_MORE_INFORMATION',
  CANCELLED = 'CANCELLED',
  WAITING_FOR_USER_RESPONSE = 'WAITING_FOR_USER_RESPONSE',
}

export type AutofixPullRequestDetails = {
  pr_number: number;
  pr_url: string;
};

export type AutofixOptions = {
  iterative_feedback?: boolean;
};

export type AutofixUpdateEndpointResponse = {
  run_id: number;
  message?: string;
  status?: 'success' | 'error';
};

export type AutofixRepository = {
  default_branch: string;
  external_id: string;
  integration_id: string;
  name: string;
  provider: string;
  url: string;
  is_readable?: boolean;
  is_writeable?: boolean;
};

export type AutofixData = {
  created_at: string;
  repositories: AutofixRepository[];
  run_id: string;
  status: AutofixStatus;
  actor_ids?: number[];
  codebase_indexing?: {
    status: 'COMPLETED';
  };
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
  key: string;
  progress: AutofixProgressItem[];
  status: AutofixStatus;
  title: string;
  type: AutofixStepType;
  active_comment_thread?: CommentThread | null;
  completedMessage?: string;
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

export type CodeSnippetContext = {
  file_path: string;
  repo_name: string;
  snippet: string;
  end_line?: number;
  start_line?: number;
};

export type AutofixInsight = {
  insight: string;
  justification: string;
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
}

export type AutofixRelevantCodeFile = {
  file_path: string;
  repo_name: string;
};

export type AutofixTimelineEvent = {
  code_snippet_and_analysis: string;
  relevant_code_file: AutofixRelevantCodeFile;
  timeline_item_type: 'internal_code' | 'external_system' | 'human_action';
  title: string;
  is_most_important_event?: boolean;
};

export type AutofixSolutionTimelineEvent = {
  code_snippet_and_analysis: string;
  relevant_code_file: AutofixRelevantCodeFile;
  timeline_item_type: 'internal_code';
  title: string;
  is_most_important_event?: boolean;
};

export type AutofixRootCauseData = {
  id: string;
  description?: string; // TODO: this is for backwards compatibility with old runs, we should remove it soon
  root_cause_reproduction?: AutofixTimelineEvent[];
};

export type EventMetadataWithAutofix = EventMetadata & {
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
