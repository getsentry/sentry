import {useEffect, useRef, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import type {InitializedAgenticProgressRun} from './types';

type UseAgenticProgressInitOptions = {
  enabled: boolean;
};

export function useAgenticProgressInit({enabled}: UseAgenticProgressInitOptions) {
  const organization = useOrganization();
  const [initialClientRunId] = useState(uuid4);
  const [clientRunId] = useSessionStorage(
    `agentic-progress-client-run-id:${organization.id}`,
    initialClientRunId
  );
  const startedForClientRunId = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      fetchMutation<InitializedAgenticProgressRun>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/onboarding/agent/runs/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {clientRunId},
      }),
  });
  const {mutate} = mutation;

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
