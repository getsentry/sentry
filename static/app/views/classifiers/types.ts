import type {User} from 'sentry/types/user';

import type {CLASSIFIER_DATASETS} from './constants';

export type ClassifierDataset = (typeof CLASSIFIER_DATASETS)[number];

export type ClassifierOutputType = 'binary' | 'choice' | 'score';

export type ClassifierOutputConfig =
  | {binaryThreshold: number; outputType: 'binary'}
  | {binaryThreshold: null; outputType: Exclude<ClassifierOutputType, 'binary'>};

type TelemetryClassifierBase = {
  createdBy: User | null;
  dataset: ClassifierDataset;
  dateAdded: string;
  dateUpdated: string;
  filterQuery: string;
  id: string;
  name: string;
  naturalLanguagePrompt: string | null;
  prebuiltClassifierKey: string | null;
  projectId: string;
  resultAttribute: string;
  status: 'disabled' | 'enabled';
};

export type TelemetryClassifier = TelemetryClassifierBase & ClassifierOutputConfig;

type PrebuiltClassifierBase = {
  dataset: ClassifierDataset;
  description: string;
  key: string;
  name: string;
  resultAttribute: string;
};

export type PrebuiltClassifier = PrebuiltClassifierBase & ClassifierOutputConfig;
