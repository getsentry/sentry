import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {EscalationPolicy} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';

interface FetchEscalationPolicyDetailsParams {
  escalationPolicyId: string;
  orgSlug: string;
}

interface FetchEscalationPolicyDetailsResponse {
  escalationPolicy: EscalationPolicy;
}

export const makeFetchEscalationPoliciesKey = ({
  orgSlug,
  escalationPolicyId,
}: FetchEscalationPolicyDetailsParams): ApiQueryKey => [
  `/organizations/${orgSlug}/escalation-policies/${escalationPolicyId}`,
  {
    query: {},
  },
];

export const useFetchEscalationPolicyDetails = (
  params: FetchEscalationPolicyDetailsParams,
  options: Partial<UseApiQueryOptions<FetchEscalationPolicyDetailsResponse>> = {}
) => {
  return useApiQuery<FetchEscalationPolicyDetailsResponse>(
    makeFetchEscalationPoliciesKey(params),
    {
      staleTime: 0,
      ...options,
    }
  );
};
