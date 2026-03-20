import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {UseMutationOptions} from 'sentry/utils/queryClient';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

interface ValidateAttributesVariables {
  attributes: string[];
  itemType: TraceItemDataset;
  query?: Record<string, string | string[] | undefined>;
}

interface AttributeValidationResult {
  valid: boolean;
  error?: string;
  type?: 'boolean' | 'number' | 'string';
}

interface ValidateAttributesResponse {
  attributes: Record<string, AttributeValidationResult>;
}

export function useValidateTraceItemAttributes(
  options: Omit<
    UseMutationOptions<
      ValidateAttributesResponse,
      RequestError,
      ValidateAttributesVariables
    >,
    'mutationFn'
  > = {}
) {
  const organization = useOrganization();

  return useMutation<
    ValidateAttributesResponse,
    RequestError,
    ValidateAttributesVariables
  >({
    ...options,
    mutationFn: ({itemType, attributes, query}: ValidateAttributesVariables) => {
      return fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/trace-items/attributes/validate/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        data: {itemType, attributes},
        method: 'POST',
        options: {query},
      });
    },
  });
}
