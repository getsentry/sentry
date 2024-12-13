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

export type AutofixRepository = {
  default_branch: string;
  external_id: string;
  name: string;
  provider: string;
  url: string;
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

export type AutofixStep = AutofixDefaultStep | AutofixRootCauseStep | AutofixChangesStep;

interface BaseStep {
  id: string;
  index: number;
  progress: AutofixProgressItem[];
  status: AutofixStatus;
  title: string;
  type: AutofixStepType;
  completedMessage?: string;
  output_stream?: string | null;
}

export type CodeSnippetContext = {
  file_path: string;
  repo_name: string;
  snippet: string;
  end_line?: number;
  start_line?: number;
};

export type StacktraceContext = {
  code_snippet: string;
  col_no: number;
  file_name: string;
  function: string;
  line_no: number;
  repo_name: string;
  vars_as_json: string;
};

export type BreadcrumbContext = {
  body: string;
  category: string;
  data_as_json: string;
  level: string;
  type: string;
};

export type AutofixInsight = {
  breadcrumb_context: BreadcrumbContext[];
  codebase_context: CodeSnippetContext[];
  insight: string;
  justification: string;
  stacktrace_context: StacktraceContext[];
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

export type AutofixCodebaseChange = {
  description: string;
  diff: FilePatch[];
  repo_name: string;
  title: string;
  diff_str?: string;
  pull_request?: AutofixPullRequestDetails;
  repo_external_id?: string;
  repo_id?: number; // The repo_id is only here for temporary backwards compatibility for LA customers, and we should remove it soon. Use repo_external_id instead.
};

export interface AutofixChangesStep extends BaseStep {
  changes: AutofixCodebaseChange[];
  type: AutofixStepType.CHANGES;
}

export type AutofixRootCauseCodeContext = {
  description: string;
  id: string;
  title: string;
  snippet?: CodeSnippetContext;
};

export type AutofixRootCauseUnitTest = {
  description: string;
  file_path: string;
  snippet: string;
};

export type AutofixRootCauseData = {
  code_context: AutofixRootCauseCodeContext[];
  description: string;
  id: string;
  title: string;
  reproduction?: string;
  unit_test?: AutofixRootCauseUnitTest;
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
