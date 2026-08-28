import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';

import {authConfigQueryOptions} from './useAuthConfig';

export type SecondFactorAuthResult = AuthenticatedResult;

interface MfaMethodsResponse {
  mfaMethods: MfaMethod[];
  mfaRequired: true;
}

interface SmsChallengeResponse {
  expiresIn: number;
  method: 'sms';
}

interface WebAuthnChallengeResponse {
  challenge: {
    webAuthnAuthenticationData: string;
  };
  method: 'u2f';
}

type MfaChallengeResponse = SmsChallengeResponse | WebAuthnChallengeResponse;

interface SmsChallengeResult extends SmsChallengeResponse {
  activatedAt: number;
}

type MfaChallengeResult = SmsChallengeResult | WebAuthnChallengeResponse;

export interface WebAuthnResponse {
  authenticatorData: string;
  clientData: string;
  keyHandle: string;
  signatureData: string;
}

export type SecondFactorCredentials =
  | {method: Exclude<MfaMethod['id'], 'u2f'>; otp: string}
  | {method: 'u2f'; response: WebAuthnResponse};

type SecondFactorChallengeMethod = Extract<MfaMethod['id'], 'sms' | 'u2f'>;

export const secondFactorMethodsQueryOptions = apiOptions.as<MfaMethodsResponse>()(
  '/auth/2fa/',
  {staleTime: 0}
);

export function useSecondFactorMethods(enabled: boolean) {
  return useQuery({
    ...secondFactorMethodsQueryOptions,
    enabled,
  });
}

export function useSecondFactorChallenge() {
  const mutation = useMutation({
    mutationFn: async (
      method: SecondFactorChallengeMethod
    ): Promise<MfaChallengeResult> => {
      const response = await fetchMutation<MfaChallengeResponse>({
        url: getApiUrl('/auth/2fa/challenge/'),
        method: 'POST',
        data: {method},
      });

      return response.method === 'sms'
        ? {...response, activatedAt: Date.now()}
        : response;
    },
  });

  return {
    activate: mutation.mutate,
    errorMessage: mutation.error
      ? getRequestErrorUserMessage(
          mutation.error,
          t('Unable to send an authentication challenge. Please try again.')
        )
      : null,
    isPending: mutation.isPending,
    reset: mutation.reset,
    result: mutation.data ?? null,
  };
}

export function useSecondFactorAuth() {
  const mutation = useMutation({
    mutationFn: (credentials: SecondFactorCredentials) =>
      fetchMutation<SecondFactorAuthResult>({
        url: getApiUrl('/auth/2fa/'),
        method: 'POST',
        data: credentials,
      }),
  });

  return {
    authenticate: mutation.mutate,
    errorMessage: mutation.error
      ? getRequestErrorUserMessage(
          mutation.error,
          t('Unable to verify the authentication code. Please try again.')
        )
      : null,
    isPending: mutation.isPending,
    reset: mutation.reset,
    result: mutation.data ?? null,
  };
}

export function useCancelSecondFactorAuth() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      fetchMutation<void>({
        url: getApiUrl('/auth/2fa/'),
        method: 'DELETE',
      }),
    onSuccess: () => {
      // Remove rather than invalidate because these methods belong to the cancelled
      // MFA session. A later session must not render them while refetching or if the
      // refetch fails.
      queryClient.removeQueries({queryKey: secondFactorMethodsQueryOptions.queryKey});
      queryClient.setQueryData(authConfigQueryOptions.queryKey, cachedResponse => {
        if (!cachedResponse || 'nextUri' in cachedResponse.json) {
          return cachedResponse;
        }

        return {
          ...cachedResponse,
          json: {...cachedResponse.json, pendingMfa: null},
        };
      });
      void queryClient.invalidateQueries({queryKey: authConfigQueryOptions.queryKey});
    },
  });

  return {
    cancel: mutation.mutate,
    errorMessage: mutation.error
      ? getRequestErrorUserMessage(
          mutation.error,
          t('Unable to cancel two-factor authentication. Please try again.')
        )
      : null,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}
