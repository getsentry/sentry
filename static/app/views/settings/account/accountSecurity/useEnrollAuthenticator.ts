import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {EnrollPayload} from './components/enrollFormTypes';

export function useEnrollAuthenticator(interfaceId: string) {
  return useMutation({
    mutationFn: (data: EnrollPayload) =>
      fetchMutation({
        url: getApiUrl('/users/$userId/authenticators/$interfaceId/enroll/', {
          path: {userId: 'me', interfaceId},
        }),
        method: 'POST',
        data,
      }),
  });
}
