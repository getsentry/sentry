import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

function classifierApiOptions(organizationSlug: string, classifierId: string) {
  return apiOptions.as<TelemetryClassifier>()(
    '/organizations/$organizationIdOrSlug/classifiers/$classifierId/',
    {
      path: {organizationIdOrSlug: organizationSlug, classifierId},
      staleTime: 0,
    }
  );
}

export function useClassifier(classifierId: string) {
  const organization = useOrganization();
  return useQuery(classifierApiOptions(organization.slug, classifierId));
}

type UpdateClassifierPayload = Partial<Pick<TelemetryClassifier, 'status'>>;

export function useUpdateClassifier(classifierId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const options = classifierApiOptions(organization.slug, classifierId);

  return useMutation({
    mutationFn: (data: UpdateClassifierPayload) =>
      fetchMutation<TelemetryClassifier>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/classifiers/$classifierId/',
          {
            path: {organizationIdOrSlug: organization.slug, classifierId},
          }
        ),
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
