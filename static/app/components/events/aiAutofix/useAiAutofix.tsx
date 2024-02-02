import {useCallback, useEffect, useState} from 'react';

import type {
  AutofixData,
  GroupWithAutofix,
} from 'sentry/components/events/aiAutofix/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const POLL_INTERVAL = 2500;

export const useAiAutofix = (group: GroupWithAutofix) => {
  const api = useApi();

  const [additionalContext, setAdditionalContext] = useState('');
  const [overwriteData, setOverwriteData] = useState<AutofixData | null>(null);
  const autofixData = overwriteData ?? group.metadata?.autofix ?? null;
  const isPolling = autofixData?.status === 'PROCESSING';

  const {
    data: apiData,
    isError,
    refetch: dataRefetch,
    error,
  } = useApiQuery<{autofix: AutofixData | null}>([`/issues/${group.id}/ai-autofix/`], {
    staleTime: Infinity,
    retry: false,
    enabled: !autofixData?.status || autofixData.status === 'PROCESSING',
    refetchInterval: data => {
      if (data?.[0]?.autofix?.status === 'PROCESSING') {
        return POLL_INTERVAL;
      }
      return false;
    },
  });

  useEffect(() => {
    if (apiData?.autofix) {
      setOverwriteData(apiData.autofix);
    }
  }, [apiData?.autofix]);

  const triggerAutofix = useCallback(async () => {
    setOverwriteData({
      status: 'PROCESSING',
      steps: [
        {
          id: '1',
          index: 0,
          status: 'PROCESSING',
          title: 'Starting Autofix...',
        },
      ],
      created_at: new Date().toISOString(),
    });

    try {
      await api.requestPromise(`/issues/${group.id}/ai-autofix/`, {
        method: 'POST',
        data: {
          additional_context: additionalContext,
        },
      });
    } catch (e) {
      // Don't need to do anything, error should be in the metadata
    }

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
