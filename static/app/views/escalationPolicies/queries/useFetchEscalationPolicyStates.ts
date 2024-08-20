import type {Group} from 'sentry/types/group';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {EscalationPolicy} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';

export type EscalationPolicyStateTypes = 'acknowledged' | 'unacknowledged' | 'resolved';

export interface EscalationPolicyState {
  dateAdded: string;
  escalationPolicy: EscalationPolicy;
  group: Group;
  id: number;
  state: EscalationPolicyStateTypes;
  team?: string;
}
interface FetchEscalationPolicyStatesParams {
  orgSlug: string;
}

export const makeFetchEscalationPolicyStatesKey = ({
  orgSlug,
}: FetchEscalationPolicyStatesParams): ApiQueryKey => [
  `/organizations/${orgSlug}/escalation-policy-states/`,
  {
    query: {},
  },
];

export const useFetchEscationPolicyStates = (
  params: FetchEscalationPolicyStatesParams,
  options: Partial<UseApiQueryOptions<EscalationPolicyState[]>> = {}
) => {
  return useApiQuery<EscalationPolicyState[]>(
    makeFetchEscalationPolicyStatesKey(params),
    {
      staleTime: 0,
      ...options,
    }
  );
};
