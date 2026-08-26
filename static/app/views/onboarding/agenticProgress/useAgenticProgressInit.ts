import {useEffect, useRef, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useMutation} from '@tanstack/react-query';

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
  const startedForClientRunId = useRef<string | null>(null);

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

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        return await initializeRun(clientRunId, onboardingCode);
      } catch (error) {
        if (!(error instanceof RequestError) || error.status !== 409) {
          throw error;
        }

        const replacementOnboardingCode = createOnboardingCode();
        setAgenticProgressOnboardingCode(replacementOnboardingCode);

        return initializeRun(clientRunId, replacementOnboardingCode);
      }
    },
  });
  const {mutate} = mutation;

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

  useEffect(() => {
    if (!enabled) {
      startedForClientRunId.current = null;
      return;
    }

    if (startedForClientRunId.current === clientRunId) {
      return;
    }

    startedForClientRunId.current = clientRunId;
    mutate();
  }, [clientRunId, enabled, mutate]);

  return mutation;
}
