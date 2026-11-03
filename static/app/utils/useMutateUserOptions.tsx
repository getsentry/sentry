import {useMutation} from '@tanstack/react-query';
import merge from 'lodash/merge';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

import type {RequestError} from './requestError/requestError';
import {removeBodyTheme} from './removeBodyTheme';
import {useApi} from './useApi';
import {useUser} from './useUser';
type UpdateUserOptionsVariables = Partial<User['options']>;

export function useMutateUserOptions() {
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
      if (
        options.theme &&
        user.options.theme !== options.theme &&
        options.theme !== 'system'
      ) {
        ConfigStore.set('theme', options.theme);
        removeBodyTheme();
      }
      ConfigStore.set('user', merge({}, user, {options}));
    },
    onError: () => {
      addErrorMessage('Failed to save user preference');
    },
  });
}
