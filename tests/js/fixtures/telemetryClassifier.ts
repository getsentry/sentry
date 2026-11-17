import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

export function TelemetryClassifierFixture(
  params: Partial<TelemetryClassifier> = {}
): TelemetryClassifier {
  return {
    id: '1',
    projectId: '1',
    name: 'User frustration',
    resultAttribute: 'user_frustration',
    dataset: 'conversation',
    filterQuery: '',
    status: 'enabled',
    prebuiltClassifierKey: 'user_frustration',
    naturalLanguagePrompt: null,
    outputType: null,
    createdBy: null,
    dateAdded: '2026-10-01T00:00:00Z',
    dateUpdated: '2026-10-01T00:00:00Z',
    ...params,
  };
}
