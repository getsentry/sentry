import {useEffect, useRef, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {InitializedAgenticProgressRun} from './types';

type UseAgenticProgressInitOptions = {
  enabled: boolean;
};

const createOnboardingCode = () => uuid4().slice(0, 10);

export function useAgenticProgressInit({enabled}: UseAgenticProgressInitOptions) {
  const organization = useOrganization();
  const {
    agenticProgressClientRunId,
    agenticProgressOnboardingCode,
    setAgenticProgressClientRunId,
    setAgenticProgressOnboardingCode,
  } = useOnboardingContext();
  const [initialClientRunId] = useState(uuid4);
  const [initialOnboardingCode] = useState(createOnboardingCode);
  const clientRunId = agenticProgressClientRunId ?? initialClientRunId;
  const onboardingCode = agenticProgressOnboardingCode ?? initialOnboardingCode;
  const onboardingCodeRef = useRef(onboardingCode);

  const initializeRun = (nextClientRunId: string, nextOnboardingCode: string) =>
    fetchMutation<InitializedAgenticProgressRun>({
      method: 'POST',
      url: getApiUrl('/organizations/$organizationIdOrSlug/onboarding/agent/runs/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      data: {
        clientRunId: nextClientRunId,
        onboardingCode: nextOnboardingCode,
      },
    });

  // A conflicting onboarding code is replaced without changing the run's cache identity.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const query = useQuery({
    queryKey: ['agentic-progress-init', organization.slug, clientRunId],
    queryFn: async () => {
      try {
        return await initializeRun(clientRunId, onboardingCodeRef.current);
      } catch (error) {
        if (!(error instanceof RequestError) || error.status !== 409) {
          throw error;
        }

        const replacementOnboardingCode = createOnboardingCode();
        onboardingCodeRef.current = replacementOnboardingCode;
        setAgenticProgressOnboardingCode(replacementOnboardingCode);

        return initializeRun(clientRunId, replacementOnboardingCode);
      }
    },
    enabled,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!agenticProgressClientRunId) {
      setAgenticProgressClientRunId(clientRunId);
    }

    if (!agenticProgressOnboardingCode) {
      setAgenticProgressOnboardingCode(onboardingCode);
    }
  }, [
    agenticProgressClientRunId,
    agenticProgressOnboardingCode,
    clientRunId,
    onboardingCode,
    setAgenticProgressClientRunId,
    setAgenticProgressOnboardingCode,
  ]);

  return query;
}
