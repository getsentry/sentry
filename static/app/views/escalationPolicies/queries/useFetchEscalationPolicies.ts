import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

export interface EscalationPolicy {
  description: string;
  id: string;
  name: string;
  organization: string;
  repeatNTimes: number;
  userId: string;
  team?: string;
}

interface FetchEscalationPoliciesParams {
  orgSlug: string;
}

interface FetchEscalationPoliciesResponse {
  escalationPolicies: EscalationPolicy[];
}

export const makeFetchEscalationPoliciesKey = ({
  orgSlug,
}: FetchEscalationPoliciesParams): ApiQueryKey => [
  `/organizations/${orgSlug}/escalation-policies/`,
  {
    query: {},
  },
];

export const useFetchEscalationPolicies = (
  params: FetchEscalationPoliciesParams,
  options: Partial<UseApiQueryOptions<FetchEscalationPoliciesResponse>> = {}
) => {
  return useApiQuery<FetchEscalationPoliciesResponse>(
    makeFetchEscalationPoliciesKey(params),
    {
      staleTime: 0,
      ...options,
    }
  );
};
