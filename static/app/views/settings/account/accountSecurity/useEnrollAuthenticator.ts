import {useMutation} from '@tanstack/react-query';

import {openEmailVerification} from 'sentry/actionCreators/modal';
import {PRIMARY_EMAIL_VERIFICATION_REQUIRED} from 'sentry/constants/apiErrorCodes';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

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
    onError: error => {
      // The enroll page can be reached directly, bypassing the check on the
      // security page, so explain the server-side requirement here too
      const detail = error instanceof RequestError ? error.responseJSON?.detail : null;
      if (
        typeof detail === 'object' &&
        detail?.code === PRIMARY_EMAIL_VERIFICATION_REQUIRED
      ) {
        openEmailVerification({actionMessage: 'enrolling a 2FA device'});
      }
    },
  });
}
