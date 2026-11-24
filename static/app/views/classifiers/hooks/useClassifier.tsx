import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {classifierDetailsApiOptions} from './classifierApiOptions';

export function useClassifier(classifierId: string) {
  const organization = useOrganization();
  return useQuery(classifierDetailsApiOptions(organization.slug, classifierId));
}

type UpdateClassifierPayload = Partial<Pick<TelemetryClassifier, 'status'>>;

export function useUpdateClassifier(classifierId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const options = classifierDetailsApiOptions(organization.slug, classifierId);

  return useMutation({
    mutationFn: (data: UpdateClassifierPayload) =>
      fetchMutation<TelemetryClassifier>({
        url: parseQueryKey(options.queryKey).url,
        method: 'PUT',
        data,
      }),
    onSuccess: classifier => {
      queryClient.setQueryData(options.queryKey, prev =>
        prev ? {...prev, json: classifier} : prev
      );
    },
  });
}

export function useDeleteClassifier(classifierId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchMutation<void>({
        url: parseQueryKey(
          classifierDetailsApiOptions(organization.slug, classifierId).queryKey
        ).url,
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(
        apiOptions.queryFilter('/organizations/$organizationIdOrSlug/classifiers/', {
          path: {organizationIdOrSlug: organization.slug},
        })
      );
    },
  });
}
