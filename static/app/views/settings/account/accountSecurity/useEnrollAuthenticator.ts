import {useMutation} from '@tanstack/react-query';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

import type {EnrollPayload} from './components/enrollFormTypes';

export function useEnrollAuthenticator(interfaceId: string) {
  return useMutation({
    mutationFn: (data: EnrollPayload) =>
      apiFetch({
        queryKey: [
          getApiUrl('/users/$userId/authenticators/$interfaceId/enroll/', {
            path: {userId: 'me', interfaceId},
          }),
          {method: 'POST', data},
        ],
      }),
  });
}
