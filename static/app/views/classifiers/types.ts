import type {User} from 'sentry/types/user';

export const CLASSIFIER_DATASETS = ['conversation', 'trace_spans'] as const;

export type ClassifierDataset = (typeof CLASSIFIER_DATASETS)[number];

export type ClassifierOutputType = 'binary' | 'choice' | 'score';

export interface TelemetryClassifier {
  binaryThreshold: number | null;
  createdBy: User | null;
  dataset: ClassifierDataset;
  dateAdded: string;
  dateUpdated: string;
  filterQuery: string;
  id: string;
  name: string;
  naturalLanguagePrompt: string | null;
  outputType: ClassifierOutputType | null;
  prebuiltClassifierKey: string | null;
  projectId: string;
  resultAttribute: string;
  status: 'disabled' | 'enabled';
}

export interface PrebuiltClassifier {
  binaryThreshold: number | null;
  dataset: ClassifierDataset;
  description: string;
  key: string;
  name: string;
  outputType: ClassifierOutputType;
  resultAttribute: string;
}
