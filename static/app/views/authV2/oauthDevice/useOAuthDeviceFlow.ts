import {useEffect, useState} from 'react';
import {useLocation} from 'react-router';
import {useMutation, useQuery} from '@tanstack/react-query';

import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {canRetryOAuthRequest} from 'sentry/views/authV2/oauth/errors';
import {deviceDecisionMutationOptions} from 'sentry/views/authV2/oauth/mutations';
import {
  deviceConsentQueryOptions,
  deviceContextQueryOptions,
} from 'sentry/views/authV2/oauth/queries';
import type {DeviceContext, OAuthDecision} from 'sentry/views/authV2/oauth/types';
import {useOAuthAuthenticationState} from 'sentry/views/authV2/oauth/useOAuthAuthenticationState';
import {useOAuthSession} from 'sentry/views/authV2/oauth/useOAuthSession';

export function useOAuthDeviceFlow() {
  const location = useLocation();

  // The URL only seeds code entry. Keeping edits local avoids navigation and lets
  // the input stay mounted while context, authentication, and consent settle.
  const [userCode, setUserCode] = useState(
    () => new URLSearchParams(location.search).get('user_code') ?? ''
  );

  // External authentication must return to the entered code, even if it was not
  // present in the initial URL.
  const returnTo = userCode
    ? `${location.pathname}?user_code=${encodeURIComponent(userCode)}`
    : location.pathname;

  const session = useOAuthSession(returnTo);
  const contextQuery = useQuery({
    ...deviceContextQueryOptions(userCode),
    enabled: Boolean(userCode),
  });
  const contextData = contextQuery.data;
  const context: Extract<DeviceContext, {stage: 'context'}> | undefined =
    contextData?.stage === 'context' ? contextData : undefined;

  // Use the validated code so consent refers to the same device grant. Session
  // scoping keeps its preparation isolated when the account changes.
  const consentQuery = useQuery({
    ...deviceConsentQueryOptions(context?.userCode ?? userCode, session.sessionKey),
    enabled: Boolean(context) && !session.needsAuthentication,
  });

  const decision = useMutation(deviceDecisionMutationOptions());

  // Consent uses 400 for both invalid codes and organization access failures.
  // Revalidate the code so expiration returns to input while access errors retain
  // the account controls needed to sign in with an eligible account.
  const consentError = decision.error ?? consentQuery.error;
  const revalidateCode = contextQuery.refetch;

  useEffect(() => {
    if (consentError instanceof RequestError && consentError.status === 400) {
      void revalidateCode();
    }
  }, [consentError, revalidateCode]);

  const authentication = useOAuthAuthenticationState({
    session,
    consentError: consentQuery.error,
    isPreparingConsent: consentQuery.isPending,
  });

  // Prepared consent belongs to the current account, so decisions and account
  // switches must not overlap.
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

    enterCode: (code: string) => {
      decision.reset();
      session.refresh();

      // Retrying the same code must issue a request despite an unchanged query key.
      if (code === userCode) {
        void contextQuery.refetch();
        return;
      }

      setUserCode(code);
    },

    retry: () => {
      decision.reset();
      session.refresh();
      void contextQuery.refetch();
    },

    decide: (op: OAuthDecision, selectedOrganizationId?: string) => {
      if (
        consentQuery.data &&
        !decision.isPending &&
        !session.switchAccount.isPending &&
        !session.hasLoggedOut &&
        !session.needsAuthentication
      ) {
        decision.mutate({
          userCode: consentQuery.data.userCode,
          op,
          selectedOrganizationId,
        });
      }
    },
  };

  const shared = {
    context,
    user: session.user,
    sessionKey: session.sessionKey,
    isSwitchingAccount: session.switchAccount.isPending,
    isSubmitting: decision.isPending || decision.isSuccess,
    switchError: session.switchAccount.error,
    returnTo,
  };

  // Initial preparation stays on code entry until every section of the next
  // screen is ready, keeping the account and organization cards together.
  const loadingState = {
    ...shared,
    context: undefined,
    status: 'code-entry',
    userCode,
    isPreparingCode: Boolean(userCode),
    message: undefined,
  } as const;

  // The device polls for the outcome; the browser shows completion in place.
  if (decision.isSuccess) {
    return {
      state: {...shared, status: 'complete', outcome: decision.data.stage} as const,
      actions,
    };
  }

  // Invalid or expired codes remain editable so recovery preserves the input.
  if (contextQuery.isError) {
    return {
      state: {
        ...shared,
        context: undefined,
        status: 'code-entry',
        userCode,
        isPreparingCode: contextQuery.isFetching,
        message: getRequestErrorUserMessage(contextQuery.error),
      } as const,
      actions,
    };
  }

  if (!userCode || contextQuery.data?.stage === 'codeEntry') {
    return {
      state: {...loadingState, isPreparingCode: false} as const,
      actions,
    };
  }

  if (!context) {
    return {state: loadingState, actions};
  }

  if (authentication.status === 'loading') {
    return {state: loadingState, actions};
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
        canRetry: decision.isError || canRetryOAuthRequest(consentQuery.error),
      } as const,
      actions,
    };
  }

  if (!consentQuery.data) {
    return {state: loadingState, actions};
  }

  return {
    state: {
      ...shared,
      context,
      status: 'consent',
      consent: consentQuery.data,
      busy: decision.isPending || session.switchAccount.isPending || session.hasLoggedOut,
    } as const,
    actions,
  };
}
