import type {EventMetadata, Group} from 'sentry/types';

export type AutofixData = {
  completedAt: string | null;
  createdAt: string;
  status: 'PROCESSING' | 'COMPLETED' | 'ERROR';
  errorMessage?: string;
  fix?: {
    description: string;
    prNumber: number;
    prUrl: string;
    repoName: string;
    title: string;
  };
};

export type EventMetadataWithAutofix = EventMetadata & {
  autofix?: AutofixData;
};

export type GroupWithAutofix = Group & {
  metadata?: EventMetadataWithAutofix;
};
