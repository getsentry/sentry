import {useMutation, useQueryClient} from '@tanstack/react-query';
import merge from 'lodash/merge';

import {toast} from '@sentry/scraps/toast';

import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

import {getApiUrl} from './api/getApiUrl';
import type {RequestError} from './requestError/requestError';
import {fetchMutation} from './queryClient';
import {removeBodyTheme} from './removeBodyTheme';
import {useUser} from './useUser';
type UpdateUserOptionsVariables = Partial<User['options']>;

export function useMutateUserOptions() {
  const user = useUser();
  const queryClient = useQueryClient();
  return useMutation<User, RequestError, UpdateUserOptionsVariables>({
    mutationFn: (options: UpdateUserOptionsVariables) => {
      return fetchMutation<User>({
        url: getApiUrl('/users/$userId/', {path: {userId: 'me'}}),
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
    onSuccess: () => {
      // Pages that fetch the user, like account settings, would otherwise keep
      // showing the old preferences
      queryClient.invalidateQueries({
        queryKey: [getApiUrl('/users/$userId/', {path: {userId: 'me'}})],
      });
    },
    onError: () => {
      toast.error('Failed to save user preference');
    },
  });
}
