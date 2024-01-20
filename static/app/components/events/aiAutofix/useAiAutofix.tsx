import {useCallback, useEffect, useRef, useState} from 'react';

import {EventMetadataWithAutofix} from 'sentry/components/events/aiAutofix/types';
import {Group} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const POLL_INTERVAL = 5000;

export const useAiAutofix = (_group: Group) => {
  const organization = useOrganization();
  const api = useApi();
  const {
    data: group,
    isError,
    refetch: dataRefetch,
    error,
    dataUpdatedAt,
  } = useApiQuery<Group>([`/organizations/${organization.slug}/issues/${_group.id}/`], {
    staleTime: Infinity,
    retry: false,
  });

  const [additionalContext, setAdditionalContext] = useState<string>('');

  const metadata = (group?.metadata ?? _group.metadata) as
    | EventMetadataWithAutofix
    | undefined;
  const autofixData = metadata?.autofix;
  const isPolling = autofixData?.status === 'PROCESSING';

  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autofixData && autofixData.status === 'PROCESSING') {
      if (timeoutId.current !== null) {
        clearTimeout(timeoutId.current);
      }
      timeoutId.current = setTimeout(() => {
        timeoutId.current = null;
        dataRefetch();
      }, POLL_INTERVAL);
    } else if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
  }, [autofixData, dataUpdatedAt, dataRefetch]);

  const triggerAutofix = useCallback(async () => {
    await api.requestPromise(`/issues/${_group.id}/ai-autofix/`, {
      method: 'POST',
      data: {
        additional_context: additionalContext,
      },
    });

    dataRefetch();
  }, [api, _group.id, dataRefetch, additionalContext]);

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
