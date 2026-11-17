import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

type CreateClassifierPayload = Pick<
  TelemetryClassifier,
  'dataset' | 'filterQuery' | 'name' | 'prebuiltClassifierKey' | 'resultAttribute'
> & {project: number};

export function useCreateClassifier() {
  const organization = useOrganization();
  return useMutation({
    mutationFn: (data: CreateClassifierPayload) =>
      fetchMutation<TelemetryClassifier>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/classifiers/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data,
      }),
  });
}
