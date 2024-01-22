import {useCallback, useState} from 'react';

import {AutofixData, GroupWithAutofix} from 'sentry/components/events/aiAutofix/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const POLL_INTERVAL = 5000;

export const useAiAutofix = (group: GroupWithAutofix) => {
  const api = useApi();
  const {
    data: apiAutofixData,
    isError,
    refetch: dataRefetch,
    error,
  } = useApiQuery<AutofixData | null>([`/issues/${group.id}/ai-autofix/`], {
    staleTime: Infinity,
    retry: false,
    enabled: !group.metadata?.autofix, // Enabled only when no autofix data present
    refetchInterval: data => {
      if (data?.[0]?.status === 'PROCESSING') {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  const [additionalContext, setAdditionalContext] = useState<string>('');

  const autofixData = apiAutofixData ?? group.metadata?.autofix ?? null;
  const isPolling = autofixData?.status === 'PROCESSING';

  const triggerAutofix = useCallback(async () => {
    await api.requestPromise(`/issues/${group.id}/ai-autofix/`, {
      method: 'POST',
      data: {
        additional_context: additionalContext,
      },
    });

    dataRefetch();
  }, [api, group.id, dataRefetch, additionalContext]);

  return {
    additionalContext,
    autofixData,
    error,
    isError,
    isPolling,
    setAdditionalContext,
    triggerAutofix,
  };
};
