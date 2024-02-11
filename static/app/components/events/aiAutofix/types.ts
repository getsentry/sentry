import type {EventMetadata, Group} from 'sentry/types';

export type AutofixData = {
  created_at: string;
  status: 'PROCESSING' | 'COMPLETED' | 'NOFIX' | 'ERROR';

  codebase_indexing?: {
    status: 'COMPLETED';
  };
  completed_at?: string | null;
  error_message?: string;
  fix?: {
    description: string;
    pr_number: number;
    pr_url: string;
    repo_name: string;
    title: string;
  };
  steps?: AutofixStep[];
};

export type AutofixStep = {
  id: string;
  index: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  title: string;
  children?: AutofixStep[];
  description?: string;
};

export type EventMetadataWithAutofix = EventMetadata & {
  autofix?: AutofixData;
};

export type GroupWithAutofix = Group & {
  metadata?: EventMetadataWithAutofix;
};
