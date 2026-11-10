import {useEffect} from 'react';

import type {AuthConfig} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {canRetryOAuthRequest} from './errors';
import type {useOAuthSession} from './useOAuthSession';

type OAuthAuthenticationState =
  | {status: 'ready'}
  | {status: 'loading'}
  | {authConfig: AuthConfig; isPreparingConsent: boolean; status: 'authentication'}
  | {canRetry: boolean; message: string; status: 'error'};

interface OAuthAuthenticationStateOptions {
  consentError: Error | null;
  isPreparingConsent: boolean;
  session: ReturnType<typeof useOAuthSession>;
}

export function useOAuthAuthenticationState({
  consentError,
  isPreparingConsent,
  session,
}: OAuthAuthenticationStateOptions): OAuthAuthenticationState {
  // Consent uses 403 for both authentication requirements and access denials. Auth
  // configuration distinguishes login/pending MFA from an authenticated account
  // that cannot authorize this request.
  const forbidden = consentError instanceof RequestError && consentError.status === 403;
  const requireAuthentication = session.requireAuthentication;

  useEffect(() => {
    if (forbidden) {
      requireAuthentication();
    }
  }, [forbidden, requireAuthentication]);

  // Keep the completed login form mounted while fresh account-bound consent is
  // prepared, so the next transition reveals the account and organization together.
  if (isPreparingConsent && session.completedAuthenticationConfig) {
    return {
      status: 'authentication',
      authConfig: session.completedAuthenticationConfig,
      isPreparingConsent: true,
    };
  }

  if (!forbidden && !session.needsAuthentication) {
    return {status: 'ready'};
  }

  const authConfig = session.authConfig.data;

  if (
    session.needsAuthentication &&
    session.authConfig.isSuccess &&
    session.isAuthenticationReady &&
    authConfig &&
    !('nextUri' in authConfig)
  ) {
    return {status: 'authentication', authConfig, isPreparingConsent: false};
  }

  // nextUri confirms the session is authenticated. Surface the consent denial
  // instead of asking the same account to sign in again.
  if (
    session.authConfig.isError ||
    (session.authConfig.isSuccess && authConfig && 'nextUri' in authConfig)
  ) {
    const error = session.authConfig.error ?? consentError;

    return {
      status: 'error',
      message: getRequestErrorUserMessage(error),
      canRetry: canRetryOAuthRequest(error),
    };
  }

  // Authentication includes organization configuration; the form must be ready
  // before the flow transitions away from consent or device code entry.
  return {status: 'loading'};
}
