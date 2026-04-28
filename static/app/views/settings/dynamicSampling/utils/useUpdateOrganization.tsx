import {useMutation} from '@tanstack/react-query';
import type {UseMutationOptions} from '@tanstack/react-query';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
type Variables = Pick<Partial<Organization>, 'targetSampleRate' | 'samplingMode'>;

export function useUpdateOrganization(
  options?: Omit<
    UseMutationOptions<Organization, RequestError, Variables, unknown>,
    'mutationFn'
  >
) {
  const api = useApi();
  const organization = useOrganization();
  const endpoint = `/organizations/${organization.slug}/`;

  return useMutation<Organization, RequestError, Variables>({
    ...options,
    mutationFn: variables => {
      return api.requestPromise(endpoint, {
        method: 'PUT',
        data: variables,
      });
    },
    onSuccess: (newOrg, variables, onMutateResult, context) => {
      options?.onSuccess?.(newOrg, variables, onMutateResult, context);
      OrganizationStore.onUpdate(newOrg);
    },
  });
}
