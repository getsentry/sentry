import type {
  TelemetryClassifier,
  TelemetryClassifierOutputConfig,
} from 'sentry/views/classifiers/types';

type TelemetryClassifierFixtureParams = Partial<
  Omit<TelemetryClassifier, keyof TelemetryClassifierOutputConfig>
> &
  (TelemetryClassifierOutputConfig | {binaryThreshold?: never; outputType?: never});

export function TelemetryClassifierFixture(
  params: TelemetryClassifierFixtureParams = {}
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
    outputType: 'binary',
    binaryThreshold: 0.8,
    createdBy: null,
    dateAdded: '2026-10-01T00:00:00Z',
    dateUpdated: '2026-10-01T00:00:00Z',
    ...params,
  };
}
