import {
  getApiQueryData,
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

type DeleteEscalationPolicyParams = {
  escalationPolicyId: string;
  orgSlug: string;
};

type DeleteEscalationPolicyResponse = unknown;

type DeleteEscalationPolicyContext = {
  previousEscalationPolicies?: EscalationPolicy[];
};

export const useDeleteEscalationPolicy = (
  options: Omit<
    UseMutationOptions<
      DeleteEscalationPolicyResponse,
      RequestError,
      DeleteEscalationPolicyParams,
      DeleteEscalationPolicyContext
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    DeleteEscalationPolicyResponse,
    RequestError,
    DeleteEscalationPolicyParams,
    DeleteEscalationPolicyContext
  >({
    ...options,
    mutationFn: ({orgSlug, escalationPolicyId}: DeleteEscalationPolicyParams) =>
      api.requestPromise(
        `/organizations/${orgSlug}/escalation-policies/${escalationPolicyId}/`,
        {
          method: 'DELETE',
        }
      ),
    onMutate: async variables => {
      // Delete escalation policy from FE cache
      await queryClient.cancelQueries(
        makeFetchEscalationPoliciesKey({orgSlug: variables.orgSlug})
      );

      const previousEscalationPolicies = getApiQueryData<EscalationPolicy[]>(
        queryClient,
        makeFetchEscalationPoliciesKey({orgSlug: variables.orgSlug})
      );

      setApiQueryData(
        queryClient,
        makeFetchEscalationPoliciesKey({orgSlug: variables.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(
            escalationPolicy => escalationPolicy.id !== variables.escalationPolicyId
          );
        }
      );
      options.onMutate?.(variables);

      return {previousEscalationPolicies};
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
};
