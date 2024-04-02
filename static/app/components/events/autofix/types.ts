import type {EventMetadata, Group} from 'sentry/types';

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

export type AutofixResult = {
  description: string;
  pr_number: number;
  pr_url: string;
  repo_name: string;
  title: string;
  diff?: FilePatch[];
};

export type AutofixData = {
  created_at: string;
  run_id: string;
  status: 'PROCESSING' | 'COMPLETED' | 'NOFIX' | 'ERROR' | 'NEED_MORE_INFORMATION';
  codebase_indexing?: {
    status: 'COMPLETED';
  };
  completed_at?: string | null;
  error_message?: string;
  fix?: AutofixResult;
  steps?: AutofixStep[];
};

export type AutofixProgressItem = {
  message: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'NEED_MORE_INFORMATION' | 'USER_RESPONSE';
  data?: any;
};

export type AutofixRootCauseProgressItem = {
  data: {
    causes: AutofixRootCauseData[];
  };
  message: string;
  timestamp: string;
  type: 'NEED_MORE_INFORMATION';
};

export type AutofixStep = BaseAutofixStep | AutofixRootCauseStep;

export type BaseAutofixStep = {
  id: string;
  index: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  title: string;
  completedMessage?: string;
  progress?: Array<AutofixProgressItem | AutofixStep>;
};

export type AutofixRootCauseStep = {
  id: 'root_cause_analysis';
  progress: [AutofixRootCauseProgressItem];
  status: 'NEED_MORE_INFORMATION' | 'COMPLETED';
  title: string;
  completedMessage?: string;
};

export type AutofixRootCauseSuggestedFixSnippet = {
  file_path: string;
  snippet: string;
};

export type AutofixRootCauseSuggestedFix = {
  description: string;
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
