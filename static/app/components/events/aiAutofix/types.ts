import type {EventMetadata, Group} from 'sentry/types';

export type AutofixResult = {
  description: string;
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
  progress: Array<AutofixProgressItem | AutofixStep>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  title: string;
  completedMessage?: string;
};

export type EventMetadataWithAutofix = EventMetadata & {
  autofix?: AutofixData;
};

export type GroupWithAutofix = Group & {
  metadata?: EventMetadataWithAutofix;
};
