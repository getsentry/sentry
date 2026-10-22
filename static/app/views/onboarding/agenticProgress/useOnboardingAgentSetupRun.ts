import {useCallback, useMemo} from 'react';

import type {AgenticRunSession} from 'sentry/components/onboarding/agenticProgress/types';
import {useAgenticSetupRun} from 'sentry/components/onboarding/agenticProgress/useAgenticSetupRun';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';

export function useOnboardingAgentSetupRun({enabled}: {enabled: boolean}) {
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

  return useAgenticSetupRun({enabled, session, onSessionChange});
}
