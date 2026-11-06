import type {User} from 'sentry/types/user';

export type ClassifierDataset = 'conversation' | 'trace_spans';

export interface TelemetryClassifier {
  createdBy: User | null;
  dataset: ClassifierDataset;
  dateAdded: string;
  dateUpdated: string;
  filterQuery: string;
  id: string;
  name: string;
  naturalLanguagePrompt: string | null;
  outputType: 'binary' | 'choice' | 'score' | null;
  prebuiltClassifierKey: string | null;
  projectId: string;
  resultAttribute: string;
  status: 'disabled' | 'enabled';
}
