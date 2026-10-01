import {useCallback, useMemo} from 'react';

import type {AgenticRunSession} from 'sentry/components/onboarding/agenticProgress/types';
import {
  createAgenticRunSession,
  useAgenticProgressInit,
} from 'sentry/components/onboarding/agenticProgress/useAgenticProgressInit';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';

function useOnboardingAgentSession() {
  const {
    agenticProgressClientRunId,
    agenticProgressOnboardingCode,
    setAgenticProgressClientRunId,
    setAgenticProgressOnboardingCode,
  } = useOnboardingContext();
  const session = useMemo(
    () =>
      agenticProgressClientRunId && agenticProgressOnboardingCode
        ? {
            clientRunId: agenticProgressClientRunId,
            onboardingCode: agenticProgressOnboardingCode,
          }
        : undefined,
    [agenticProgressClientRunId, agenticProgressOnboardingCode]
  );

  const onSessionChange = useCallback(
    (next: AgenticRunSession) => {
      setAgenticProgressClientRunId(next.clientRunId);
      setAgenticProgressOnboardingCode(next.onboardingCode);
    },
    [setAgenticProgressClientRunId, setAgenticProgressOnboardingCode]
  );

  return {session, onSessionChange};
}

export function useOnboardingAgenticProgressInit({enabled}: {enabled: boolean}) {
  const {session, onSessionChange} = useOnboardingAgentSession();

  return useAgenticProgressInit({enabled, session, onSessionChange}).query;
}

export function useRestartAgenticRun() {
  const {onSessionChange} = useOnboardingAgentSession();

  return useCallback(() => {
    onSessionChange(createAgenticRunSession());
  }, [onSessionChange]);
}
