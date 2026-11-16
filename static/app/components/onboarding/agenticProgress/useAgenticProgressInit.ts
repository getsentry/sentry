import {useCallback, useEffect, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AgenticProgressRun, AgenticRunSession} from './types';

export type UseAgenticProgressInitOptions = {
  enabled: boolean;
  /** The host retains session updates so retries and remounts reuse the run identity. */
  onSessionChange: (session: AgenticRunSession) => void;
  session: AgenticRunSession | undefined;
  createOnboardingCode?: boolean;
};

const createOnboardingCode = () => uuid4().slice(0, 10);

const createAgenticRunSession = (withOnboardingCode: boolean): AgenticRunSession => ({
  clientRunId: uuid4(),
  ...(withOnboardingCode ? {onboardingCode: createOnboardingCode()} : {}),
});

export function useAgenticProgressInit({
  createOnboardingCode: shouldCreateOnboardingCode = true,
  enabled,
  onSessionChange,
  session,
}: UseAgenticProgressInitOptions) {
  const organization = useOrganization();
  const [initialSession] = useState(() =>
    createAgenticRunSession(shouldCreateOnboardingCode)
  );
  const currentSession = session ?? initialSession;
  const {clientRunId, onboardingCode} = currentSession;

  const initializeRun = (nextSession: AgenticRunSession) =>
    fetchMutation<AgenticProgressRun>({
      method: 'POST',
      url: getApiUrl('/organizations/$organizationIdOrSlug/onboarding/agent/runs/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      data: nextSession,
    });

  // A conflicting onboarding code is replaced without changing the run's cache identity.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const query = useQuery({
    queryKey: ['agentic-progress-init', organization.slug, clientRunId],
    queryFn: async ({signal}) => {
      try {
        return await initializeRun(currentSession);
      } catch (error) {
        if (
          signal.aborted ||
          !onboardingCode ||
          !(error instanceof RequestError) ||
          error.status !== 409
        ) {
          throw error;
        }

        const replacementOnboardingCode = createOnboardingCode();
        const replacementSession = {
          clientRunId,
          onboardingCode: replacementOnboardingCode,
        };
        onSessionChange(replacementSession);

        return initializeRun(replacementSession);
      }
    },
    enabled,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (enabled && !session) {
      onSessionChange(initialSession);
    }
  }, [enabled, initialSession, onSessionChange, session]);

  const restartRun = useCallback(() => {
    onSessionChange(createAgenticRunSession(shouldCreateOnboardingCode));
  }, [onSessionChange, shouldCreateOnboardingCode]);

  return {
    query,
    onboardingCode: query.data?.onboardingCode ?? onboardingCode,
    restartRun,
  };
}
