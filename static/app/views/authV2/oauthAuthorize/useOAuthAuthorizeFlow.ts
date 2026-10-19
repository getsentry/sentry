import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {useMutation, useQuery} from '@tanstack/react-query';

import type {AuthConfig} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {canRetryOAuthRequest} from 'sentry/views/authV2/oauth/errors';
import {authorizationDecisionMutationOptions} from 'sentry/views/authV2/oauth/mutations';
import {
  authorizationConsentQueryOptions,
  authorizationContextQueryOptions,
} from 'sentry/views/authV2/oauth/queries';
import type {
  AuthorizationParameters,
  AuthorizationConsent,
  OAuthContext,
  OAuthDecision,
} from 'sentry/views/authV2/oauth/types';
import {useOAuthSession} from 'sentry/views/authV2/oauth/useOAuthSession';

const authorizationFields = [
  'client_id',
  'response_type',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const;

export function useOAuthAuthorizeFlow() {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const params: AuthorizationParameters = Object.fromEntries(
    authorizationFields.flatMap(key => {
      const value = search.get(key);

      return value === null ? [] : [[key, value]];
    })
  );

  // Application details must be available before login; consent transactions belong
  // to the current session and are prepared only after the request is validated.
  const session = useOAuthSession(`${location.pathname}${location.search}`);
  const contextQuery = useQuery(authorizationContextQueryOptions(params));
  const consentQuery = useQuery({
    ...authorizationConsentQueryOptions(params, session.sessionKey),
    enabled: contextQuery.data?.stage === 'context' && !session.needsAuthentication,
  });

  const decision = useMutation({
    ...authorizationDecisionMutationOptions(),
    onSuccess: result => testableWindowLocation.assign(result.redirectUrl),
  });
  const submittedTransaction = useRef<string | null>(null);

  const consent = consentQuery.data;

  // Consent uses 403 for both authentication requirements and access denials. Auth
  // configuration distinguishes login/pending MFA from an already authenticated
  // account that cannot authorize this request.
  const forbidden =
    consentQuery.error instanceof RequestError && consentQuery.error.status === 403;
  const requireAuthentication = session.requireAuthentication;

  useEffect(() => {
    if (forbidden) {
      requireAuthentication();
    }
  }, [forbidden, requireAuthentication]);

  const redirectUrl =
    contextQuery.data?.stage === 'redirect'
      ? contextQuery.data.redirectUrl
      : consent?.stage === 'redirect'
        ? consent.redirectUrl
        : undefined;

  useEffect(() => {
    if (redirectUrl) {
      testableWindowLocation.assign(redirectUrl);
    }
  }, [redirectUrl]);

  // Prior consent can skip the prompt, but approval still needs a fresh transaction.
  // Remember its submission because an effect rerun must not redeem it twice.
  const forcePrompt = Boolean(search.get('force_prompt'));
  const autoApprove =
    consent?.stage === 'consent' && consent.hasExistingConsent && !forcePrompt;
  const {mutate} = decision;

  useEffect(() => {
    if (
      !autoApprove ||
      consent?.stage !== 'consent' ||
      submittedTransaction.current === consent.transactionId ||
      session.switchAccount.isPending
    ) {
      return;
    }

    submittedTransaction.current = consent.transactionId;
    mutate({transactionId: consent.transactionId, op: 'approve'});
  }, [autoApprove, consent, mutate, session.switchAccount.isPending]);

  // Consent belongs to the current account. Block decisions during account switching
  // so a transaction prepared for the previous account cannot be submitted.
  const actions = {
    onAuthenticated: session.onAuthenticated,
    switchAccount: () => {
      if (
        !decision.isPending &&
        !decision.isSuccess &&
        !session.switchAccount.isPending
      ) {
        session.switchAccount.mutate();
      }
    },

    retry: () => {
      decision.reset();
      session.refresh();
      void contextQuery.refetch();
    },

    decide: (op: OAuthDecision, selectedOrganizationId?: string) => {
      if (
        consent?.stage === 'consent' &&
        !decision.isPending &&
        !session.switchAccount.isPending &&
        !session.hasLoggedOut &&
        !session.needsAuthentication
      ) {
        mutate({transactionId: consent.transactionId, op, selectedOrganizationId});
      }
    },
  };

  const contextData = contextQuery.data;
  const context: OAuthContext | undefined =
    contextData?.stage === 'context' ? contextData : undefined;
  const shared = {
    context,
    user: session.user,
    sessionKey: session.sessionKey,
    isSwitchingAccount: session.switchAccount.isPending,
    isSubmitting: decision.isPending || decision.isSuccess,
    switchError: session.switchAccount.error,
    returnTo: `${location.pathname}${location.search}`,
  };

  if (contextQuery.isError) {
    return {
      state: {
        ...shared,
        status: 'error',
        message: getRequestErrorUserMessage(contextQuery.error),
        canRetry: canRetryOAuthRequest(contextQuery.error),
      } as const,
      actions,
    };
  }

  if (!context || redirectUrl) {
    return {state: {...shared, status: 'loading'} as const, actions};
  }

  // Keep the completed login form mounted while preparing consent so the next
  // transition reveals the account and organization choices together.
  if (consentQuery.isPending && session.completedAuthenticationConfig) {
    return {
      state: {
        ...shared,
        status: 'authentication',
        authConfig: session.completedAuthenticationConfig,
        isPreparingConsent: true,
      } as const,
      actions,
    };
  }

  if (forbidden || session.needsAuthentication) {
    const authConfig = session.authConfig.data;

    if (
      session.needsAuthentication &&
      session.authConfig.isSuccess &&
      session.isAuthenticationReady &&
      authConfig &&
      !('nextUri' in authConfig)
    ) {
      const loginConfig: AuthConfig = authConfig;

      return {
        state: {
          ...shared,
          status: 'authentication',
          authConfig: loginConfig,
          isPreparingConsent: false,
        } as const,
        actions,
      };
    }

    // nextUri confirms the session is authenticated. Surface the consent denial
    // instead of asking the same account to sign in again.
    if (
      session.authConfig.isError ||
      (session.authConfig.isSuccess && authConfig && 'nextUri' in authConfig)
    ) {
      return {
        state: {
          ...shared,
          status: 'error',
          message: getRequestErrorUserMessage(
            session.authConfig.error ?? consentQuery.error
          ),
          canRetry: canRetryOAuthRequest(session.authConfig.error ?? consentQuery.error),
        } as const,
        actions,
      };
    }

    return {state: {...shared, status: 'loading'} as const, actions};
  }

  if (consentQuery.isError || decision.isError) {
    return {
      state: {
        ...shared,
        status: 'error',
        message: getRequestErrorUserMessage(decision.error ?? consentQuery.error),
        canRetry: canRetryOAuthRequest(decision.error ?? consentQuery.error),
      } as const,
      actions,
    };
  }

  if (consent?.stage !== 'consent') {
    return {state: {...shared, status: 'loading'} as const, actions};
  }

  const preparedConsent: AuthorizationConsent = consent;

  return {
    state: {
      ...shared,
      context,
      status: autoApprove ? 'submitting' : 'consent',
      consent: preparedConsent,
      busy:
        decision.isPending ||
        decision.isSuccess ||
        session.switchAccount.isPending ||
        session.hasLoggedOut,
    } as const,
    actions,
  };
}
