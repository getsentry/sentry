import {
  setApiQueryData,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {
  type EscalationPolicyState,
  type EscalationPolicyStateTypes,
  makeFetchEscalationPolicyStatesKey,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicyStates';

interface UpdateEscalationStatePolicyParams {
  escalationPolicyStateId: number;
  orgSlug: string;
  state: EscalationPolicyStateTypes;
}

export const useUpdateEscalationPolicyState = (
  options: Omit<
    UseMutationOptions<
      EscalationPolicyState,
      RequestError,
      UpdateEscalationStatePolicyParams
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    EscalationPolicyState,
    RequestError,
    UpdateEscalationStatePolicyParams
  >({
    ...options,
    mutationFn: ({
      orgSlug,
      escalationPolicyStateId,
      state,
    }: UpdateEscalationStatePolicyParams) =>
      api.requestPromise(
        `/organizations/${orgSlug}/escalation-policy-states/${escalationPolicyStateId}/`,
        {
          method: 'PUT',
          data: {
            state,
          },
        }
      ),
    onSuccess: (escalationPolicyState, parameters, context) => {
      setApiQueryData<EscalationPolicyState[]>(
        queryClient,
        makeFetchEscalationPolicyStatesKey({orgSlug: parameters.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.map(policyState =>
            policyState.id === escalationPolicyState.id
              ? escalationPolicyState
              : policyState
          );
        }
      );
      options.onSuccess?.(escalationPolicyState, parameters, context);
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
};
