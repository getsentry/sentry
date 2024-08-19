import {
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

interface UpdateRotationSchedulePayload extends Omit<RotationSchedule, 'id'> {
  id?: string;
}

interface UpdateRotationScheduleParams {
  orgSlug: string;
  rotationSchedule: UpdateRotationSchedulePayload;
}

export const useUpdateRotationSchedule = (
  options: Omit<
    UseMutationOptions<RotationSchedule, RequestError, UpdateRotationScheduleParams>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<RotationSchedule, RequestError, UpdateRotationScheduleParams>({
    ...options,
    mutationFn: ({orgSlug, rotationSchedule}: UpdateRotationScheduleParams) =>
      api.requestPromise(`/organizations/${orgSlug}/rotation-schedules/`, {
        method: 'PUT',
        data: rotationSchedule,
      }),
    onSuccess: (rotationSchedule, parameters, context) => {
      setApiQueryData<RotationSchedule>(
        queryClient,
        makeFetchRotationSchedulesKey({orgSlug: parameters.orgSlug}),
        rotationSchedule // Update the cache with the new rotationSchedule
      );
      options.onSuccess?.(rotationSchedule, parameters, context);
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
};
