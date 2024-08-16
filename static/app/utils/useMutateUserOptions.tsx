import merge from 'lodash/merge';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';

type UpdateUserOptionsVariables = Partial<User['options']>;
interface UseMutateProjectProps {
  onError?: (error: RequestError) => void;
  onSuccess?: () => void;
}

export default function useMutateUserOptions({
  onSuccess,
  onError,
}: UseMutateProjectProps = {}) {
  const user = useUser();
  const api = useApi({persistInFlight: false});
  return useMutation<User, RequestError, UpdateUserOptionsVariables>({
    mutationFn: (options: UpdateUserOptionsVariables) => {
      return api.requestPromise('/users/me/', {
        method: 'PUT',
        data: {options},
      });
    },
    onMutate: (options: UpdateUserOptionsVariables) => {
      ConfigStore.set('user', merge({}, user, {options}));
      return onSuccess?.();
    },
    onError: error => {
      addErrorMessage('Failed to save user preference');
      return onError?.(error);
    },
  });
}
