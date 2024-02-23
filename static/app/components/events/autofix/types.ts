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
  diff: FilePatch[];
  pr_number: number;
  pr_url: string;
  repo_name: string;
  title: string;
};

export type AutofixData = {
  created_at: string;
  status: 'PROCESSING' | 'COMPLETED' | 'NOFIX' | 'ERROR';

  codebase_indexing?: {
    status: 'COMPLETED';
  };
  completed_at?: string | null;
  error_message?: string;
  fix?: AutofixResult;
  steps?: AutofixStep[];
};

export type AutofixProgressItem = {
  data: any;
  message: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'NEED_MORE_INFORMATION' | 'USER_RESPONSE';
};

export type AutofixStep = {
  id: string;
  index: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  title: string;
  completedMessage?: string;
  progress?: Array<AutofixProgressItem | AutofixStep>;
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
