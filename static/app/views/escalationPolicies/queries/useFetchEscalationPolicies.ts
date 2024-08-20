import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

export type EscalationPolicyStepRecipient = {
  data: Team | User | RotationSchedule;
  type: 'user' | 'team' | 'schedule';
};
export type EscalationPolicyStep = {
  escalateAfterSec: number;
  recipients: EscalationPolicyStepRecipient[];
  stepNumber: number;
};

export type EscalationPolicy = {
  description: string;
  id: string;
  name: string;
  organization: string;
  repeatNTimes: number;
  steps: EscalationPolicyStep[];
  userId: string;
  team?: string;
};

interface FetchEscalationPoliciesParams {
  orgSlug: string;
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
  options: Partial<UseApiQueryOptions<EscalationPolicy[]>> = {}
) => {
  return useApiQuery<EscalationPolicy[]>(makeFetchEscalationPoliciesKey(params), {
    staleTime: 0,
    ...options,
  });
};
