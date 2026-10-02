import {useMutation} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';

export interface PasswordResetResult {
  message: string;
  status: 'accepted';
}

type PasswordResetResponse = {
  detail: string;
};

export function usePasswordReset() {
  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetchMutation<PasswordResetResponse>({
        url: getApiUrl('/auth/recovery/'),
        method: 'POST',
        data: {user: email},
      });

      return {
        status: 'accepted',
        message: response.detail,
      } satisfies PasswordResetResult;
    },
  });

  return {
    errorMessage: mutation.error
      ? getRequestErrorUserMessage(
          mutation.error,
          t('Unable to request a password reset. Please try again.')
        )
      : null,
    isPending: mutation.isPending,
    requestPasswordReset: mutation.mutate,
    reset: mutation.reset,
    result: mutation.isSuccess ? mutation.data : null,
  };
}
