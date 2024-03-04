import {useCallback, useEffect, useState} from 'react';

import type {
  AutofixData,
  GroupWithAutofix,
} from 'sentry/components/events/aiAutofix/types';
import type {Event} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const POLL_INTERVAL = 2500;

export const useAiAutofix = (group: GroupWithAutofix, event: Event) => {
  const api = useApi();

  const [overwriteData, setOverwriteData] = useState<AutofixData | 'reset' | null>(null);
  const autofixData =
    (overwriteData === 'reset' ? null : overwriteData ?? group.metadata?.autofix) ?? null;
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
    if (overwriteData !== 'reset' && apiData?.autofix) {
      setOverwriteData(apiData.autofix);
    }
  }, [apiData?.autofix, overwriteData]);

  const triggerAutofix = useCallback(
    async (additionalContext: string) => {
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
            event_id: event.id,
            additional_context: additionalContext,
          },
        });
      } catch (e) {
        // Don't need to do anything, error should be in the metadata
      }

      dataRefetch();
    },
    [api, group.id, event.id, dataRefetch]
  );

  const reset = useCallback(() => {
    setOverwriteData('reset');
  }, []);

  return {
    autofixData,
    error,
    isError,
    isPolling,
    triggerAutofix,
    reset,
  };
};
