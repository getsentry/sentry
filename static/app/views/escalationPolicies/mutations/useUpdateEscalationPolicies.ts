import {
  setApiQueryData,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {
  type EscalationPolicy,
  makeFetchEscalationPoliciesKey,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';

interface UpdateEscalationPolicyPayload extends Omit<EscalationPolicy, 'id'> {
  // If EscalationPolicy id is not provided, a new EscalationPolicy will be created.
  id?: string;
}

interface UpdateEscalationPolicyParams {
  escalationPolicy: UpdateEscalationPolicyPayload;
  orgSlug: string;
}

export const useUpdateEscalationPolicy = (
  options: Omit<
    UseMutationOptions<EscalationPolicy, RequestError, UpdateEscalationPolicyParams>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<EscalationPolicy, RequestError, UpdateEscalationPolicyParams>({
    ...options,
    mutationFn: ({orgSlug, escalationPolicy}: UpdateEscalationPolicyParams) =>
      api.requestPromise(`/organizations/${orgSlug}/escalation-policies/`, {
        method: 'PUT',
        data: escalationPolicy,
      }),
    onSuccess: (escalationPolicy, parameters, context) => {
      setApiQueryData<EscalationPolicy>(
        queryClient,
        makeFetchEscalationPoliciesKey({orgSlug: parameters.orgSlug}),
        escalationPolicy // Update the cache with the new escalationPolicy
      );
      options.onSuccess?.(escalationPolicy, parameters, context);
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
};
