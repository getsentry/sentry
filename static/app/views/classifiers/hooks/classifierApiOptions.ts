import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {
  ClassifierDataset,
  PrebuiltClassifier,
  TelemetryClassifier,
} from 'sentry/views/classifiers/types';

type ClassifiersQuery = {
  cursor?: string;
  per_page?: number;
  project?: number[];
  query?: string;
};

export function classifierListApiOptions(
  organizationSlug: string,
  query?: ClassifiersQuery
) {
  return apiOptions.as<TelemetryClassifier[]>()(
    '/organizations/$organizationIdOrSlug/classifiers/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query,
      staleTime: 0,
    }
  );
}

export function classifierDetailsApiOptions(
  organizationSlug: string,
  classifierId: string
) {
  return apiOptions.as<TelemetryClassifier>()(
    '/organizations/$organizationIdOrSlug/classifiers/$classifierId/',
    {
      path: {organizationIdOrSlug: organizationSlug, classifierId},
      staleTime: 0,
    }
  );
}

export function prebuiltClassifiersApiOptions(
  organizationSlug: string,
  dataset: ClassifierDataset
) {
  return apiOptions.as<PrebuiltClassifier[]>()(
    '/organizations/$organizationIdOrSlug/classifiers/prebuilt/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {dataset},
      staleTime: 60_000,
    }
  );
}
