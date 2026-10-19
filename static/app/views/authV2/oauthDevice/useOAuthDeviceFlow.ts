import {useEffect, useState} from 'react';
import {useLocation} from 'react-router';
import {useMutation, useQuery} from '@tanstack/react-query';

import type {AuthConfig} from 'sentry/types/auth';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {canRetryOAuthRequest} from 'sentry/views/authV2/oauth/errors';
import {deviceDecisionMutationOptions} from 'sentry/views/authV2/oauth/mutations';
import {
  deviceConsentQueryOptions,
  deviceContextQueryOptions,
} from 'sentry/views/authV2/oauth/queries';
import type {DeviceContext, OAuthDecision} from 'sentry/views/authV2/oauth/types';
import {useOAuthSession} from 'sentry/views/authV2/oauth/useOAuthSession';

export function useOAuthDeviceFlow() {
  const location = useLocation();
  const [userCode, setUserCode] = useState(
    () => new URLSearchParams(location.search).get('user_code') ?? ''
  );
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
  const consentQuery = useQuery({
    ...deviceConsentQueryOptions(context?.userCode ?? userCode, session.sessionKey),
    enabled: Boolean(context) && !session.needsAuthentication,
  });
  const decision = useMutation(deviceDecisionMutationOptions());
  const forbidden =
    consentQuery.error instanceof RequestError && consentQuery.error.status === 403;
  const requireAuthentication = session.requireAuthentication;
  useEffect(() => {
    if (forbidden) {
      requireAuthentication();
    }
  }, [forbidden, requireAuthentication]);
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
    enterCode: (code: string) => {
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
  const loadingState = {
    ...shared,
    context: undefined,
    status: 'code-entry',
    userCode,
    isPreparingCode: Boolean(userCode),
    message: undefined,
  } as const;
  if (decision.isSuccess) {
    return {
      state: {...shared, status: 'complete', outcome: decision.data.stage} as const,
      actions,
    };
  }
  if (contextQuery.isError) {
    return {
      state: {
        ...shared,
        context: undefined,
        status: 'code-entry',
        userCode,
        isPreparingCode: false,
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
    return {state: loadingState, actions};
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
