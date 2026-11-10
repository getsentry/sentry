import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ClassifierDataset, PrebuiltClassifier} from 'sentry/views/classifiers/types';

export function usePrebuiltClassifiers(dataset: ClassifierDataset) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<PrebuiltClassifier[]>()(
      '/organizations/$organizationIdOrSlug/classifiers/prebuilt/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {dataset},
        staleTime: 60_000,
      }
    )
  );
}
