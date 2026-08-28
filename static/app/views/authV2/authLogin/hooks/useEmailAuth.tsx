import {useMutation} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';

export interface EmailAuthCredentials {
  email: string;
  password: string;
}

export type EmailAuthResult =
  | {
      methods: MfaMethod[];
      status: 'mfa-required';
    }
  | (AuthenticatedResult & {status: 'authenticated'});

type EmailAuthResponse =
  | {
      mfaMethods: MfaMethod[];
      mfaRequired: true;
    }
  | AuthenticatedResult;

/**
 * Authenticate with an email address and password. The organization slug is a hint
 * for the post-authentication destination; organization SSO requirements may send
 * the user elsewhere.
 */
export function useEmailAuth(organizationSlug?: string) {
  const mutation = useMutation({
    mutationFn: async ({email, password}: EmailAuthCredentials) => {
      const response = await fetchMutation<EmailAuthResponse>({
        url: getApiUrl('/auth/login/'),
        method: 'POST',
        data: {
          username: email,
          password,
          orgSlug: organizationSlug ?? null,
        },
      });

      if ('mfaRequired' in response) {
        return {
          status: 'mfa-required',
          methods: response.mfaMethods,
        } satisfies EmailAuthResult;
      }

      return {
        status: 'authenticated',
        nextUri: response.nextUri,
        user: response.user,
      } satisfies EmailAuthResult;
    },
  });

  return {
    authenticate: mutation.mutate,
    errorMessage: mutation.error ? getEmailAuthErrorMessage(mutation.error) : null,
    isPending: mutation.isPending,
    reset: mutation.reset,
    result: mutation.isSuccess ? mutation.data : null,
  };
}

function getEmailAuthErrorMessage(error: Error): string {
  if (error instanceof RequestError) {
    const errors = error.responseJSON?.errors;

    if (errors && typeof errors === 'object' && '__all__' in errors) {
      const messages = errors.__all__;

      if (Array.isArray(messages) && typeof messages[0] === 'string') {
        return messages[0];
      }
    }
  }

  return getRequestErrorUserMessage(error, t('Unable to log in. Please try again.'));
}
