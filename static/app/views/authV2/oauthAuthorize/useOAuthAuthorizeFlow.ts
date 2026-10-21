import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {useMutation, useQuery} from '@tanstack/react-query';

import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
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
import {useOAuthAuthenticationState} from 'sentry/views/authV2/oauth/useOAuthAuthenticationState';
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

  const authentication = useOAuthAuthenticationState({
    session,
    consentError: consentQuery.error,
    isPreparingConsent: consentQuery.isPending,
  });

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
        session.switchAccount.mutate(undefined, {
          onSuccess: didRedirect => {
            if (!didRedirect) {
              decision.reset();
            }
          },
        });
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

  if (authentication.status === 'loading') {
    return {state: {...shared, status: 'loading'} as const, actions};
  }

  if (authentication.status !== 'ready') {
    return {state: {...shared, ...authentication}, actions};
  }

  if (consentQuery.isError || decision.isError) {
    return {
      state: {
        ...shared,
        status: 'error',
        message: getRequestErrorUserMessage(decision.error ?? consentQuery.error),
        // Restarting prepares a fresh transaction, which can recover an expired
        // or invalid decision even when repeating that POST would fail.
        canRetry: decision.isError || canRetryOAuthRequest(consentQuery.error),
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
