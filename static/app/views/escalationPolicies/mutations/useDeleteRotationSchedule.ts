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
  makeFetchRotationSchedulesKey,
  type RotationSchedule,
} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

type DeleteRotationScheduleParams = {
  orgSlug: string;
  rotationScheduleId: string;
};

type DeleteRotationScheduleResponse = unknown;

type DeleteRotationScheduleContext = {
  previousRotationSchedules?: RotationSchedule[];
};

export const useDeleteRotationSchedule = (
  options: Omit<
    UseMutationOptions<
      DeleteRotationScheduleResponse,
      RequestError,
      DeleteRotationScheduleParams,
      DeleteRotationScheduleContext
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    DeleteRotationScheduleResponse,
    RequestError,
    DeleteRotationScheduleParams,
    DeleteRotationScheduleContext
  >({
    ...options,
    mutationFn: ({orgSlug, rotationScheduleId}: DeleteRotationScheduleParams) =>
      api.requestPromise(
        `/organizations/${orgSlug}/rotation-schedules/${rotationScheduleId}/`,
        {
          method: 'DELETE',
        }
      ),
    onMutate: async variables => {
      // Delete rotation schedule from FE cache
      await queryClient.cancelQueries({
        queryKey: makeFetchRotationSchedulesKey({orgSlug: variables.orgSlug}),
      } as any);

      const previousRotationSchedules = getApiQueryData<RotationSchedule[]>(
        queryClient,
        makeFetchRotationSchedulesKey({orgSlug: variables.orgSlug})
      );

      setApiQueryData(
        queryClient,
        makeFetchRotationSchedulesKey({orgSlug: variables.orgSlug}),
        previousRotationSchedules?.filter(
          rotationSchedule => rotationSchedule.id !== variables.rotationScheduleId
        )
      );

      return {previousRotationSchedules};
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
};
