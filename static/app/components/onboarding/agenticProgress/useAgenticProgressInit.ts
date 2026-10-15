import {useCallback, useEffect, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AgenticRunSession, InitializedAgenticProgressRun} from './types';

export type UseAgenticProgressInitOptions = {
  enabled: boolean;
  /** The host retains session updates so retries and remounts reuse the run identity. */
  onSessionChange: (session: AgenticRunSession) => void;
  session: AgenticRunSession | undefined;
};

const createOnboardingCode = () => uuid4().slice(0, 10);

const createAgenticRunSession = (): AgenticRunSession => ({
  clientRunId: uuid4(),
  onboardingCode: createOnboardingCode(),
});

export function useAgenticProgressInit({
  enabled,
  onSessionChange,
  session,
}: UseAgenticProgressInitOptions) {
  const organization = useOrganization();
  const [initialSession] = useState(createAgenticRunSession);
  const {clientRunId, onboardingCode} = session ?? initialSession;

  const initializeRun = (nextClientRunId: string, nextOnboardingCode: string) =>
    apiFetch<InitializedAgenticProgressRun>({
      queryKey: [
        getApiUrl('/organizations/$organizationIdOrSlug/onboarding/agent/runs/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          method: 'POST',
          data: {
            clientRunId: nextClientRunId,
            onboardingCode: nextOnboardingCode,
          },
        },
      ],
    }).then(response => response.json);

  // A conflicting onboarding code is replaced without changing the run's cache identity.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const query = useQuery({
    queryKey: ['agentic-progress-init', organization.slug, clientRunId],
    queryFn: async ({signal}) => {
      try {
        return await initializeRun(clientRunId, onboardingCode);
      } catch (error) {
        if (signal.aborted || !(error instanceof RequestError) || error.status !== 409) {
          throw error;
        }

        const replacementOnboardingCode = createOnboardingCode();
        onSessionChange({clientRunId, onboardingCode: replacementOnboardingCode});

        return initializeRun(clientRunId, replacementOnboardingCode);
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
    onSessionChange(createAgenticRunSession());
  }, [onSessionChange]);

  return {
    query,
    onboardingCode: query.data?.onboardingCode ?? onboardingCode,
    restartRun,
  };
}
