import type {EventMetadata} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

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
}

export type AutofixPullRequestDetails = {
  pr_number: number;
  pr_url: string;
};

export type AutofixData = {
  created_at: string;
  run_id: string;
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'NOFIX'
    | 'ERROR'
    | 'NEED_MORE_INFORMATION';
  codebase_indexing?: {
    status: 'COMPLETED';
  };
  completed_at?: string | null;
  error_message?: string;
  steps?: AutofixStep[];
};

export type AutofixProgressItem = {
  message: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'NEED_MORE_INFORMATION' | 'USER_RESPONSE';
  data?: any;
};

export type AutofixStep = AutofixDefaultStep | AutofixRootCauseStep | AutofixChangesStep;

interface BaseStep {
  id: string;
  index: number;
  progress: AutofixProgressItem[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  title: string;
  type: AutofixStepType;
  completedMessage?: string;
}

export interface AutofixDefaultStep extends BaseStep {
  type: AutofixStepType.DEFAULT;
}

export type AutofixRootCauseSelection =
  | {
      cause_id: string;
      fix_id: string;
    }
  | {custom_root_cause: string}
  | null;

export interface AutofixRootCauseStep extends BaseStep {
  causes: AutofixRootCauseData[];
  selection: AutofixRootCauseSelection;
  type: AutofixStepType.ROOT_CAUSE_ANALYSIS;
}

export type AutofixCodebaseChange = {
  description: string;
  diff: FilePatch[];
  repo_id: number;
  repo_name: string;
  title: string;
  diff_str?: string;
  pull_request?: AutofixPullRequestDetails;
};

export interface AutofixChangesStep extends BaseStep {
  changes: AutofixCodebaseChange[];
  type: AutofixStepType.CHANGES;
}

export type AutofixRootCauseSuggestedFixSnippet = {
  file_path: string;
  snippet: string;
};

export type AutofixRootCauseSuggestedFix = {
  description: string;
  elegance: number;
  id: string;
  title: string;
  snippet?: AutofixRootCauseSuggestedFixSnippet;
};

export type AutofixRootCauseData = {
  actionability: number;
  description: string;
  id: string;
  likelihood: number;
  suggested_fixes: AutofixRootCauseSuggestedFix[];
  title: string;
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
