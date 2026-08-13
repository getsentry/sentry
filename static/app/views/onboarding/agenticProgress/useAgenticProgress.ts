import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useStream} from 'conduit-client';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import {useOrganization} from 'sentry/utils/useOrganization';

import {agenticProgressRunOptions} from './api';
import type {AgenticProgressRun} from './types';

const FALLBACK_POLL_INTERVAL_MS = 5000;

type UseAgenticProgressOptions = {
  runId: string | null;
  enabled?: boolean;
};

export function useAgenticProgress({runId, enabled = true}: UseAgenticProgressOptions) {
  const organization = useOrganization();
  const [data, setData] = useState<AgenticProgressRun | undefined>();
  const [streamConnected, setStreamConnected] = useState(false);
  const queryEnabled = enabled && runId !== null;

  const query = useQuery({
    ...agenticProgressRunOptions({
      organizationSlug: organization.slug,
      runId: queryEnabled ? runId : null,
    }),
    refetchInterval: streamConnected ? false : FALLBACK_POLL_INTERVAL_MS,
  });
  const {refetch} = query;

  useEffect(() => {
    if (!query.data) {
      return;
    }

    setData(current =>
      current?.runId === query.data.runId && current.sequence > query.data.sequence
        ? current
        : query.data
    );
  }, [query.data]);

  const clientRunId = query.data?.clientRunId;
  const startStreamData = useMemo(
    () => (clientRunId ? {clientRunId} : undefined),
    [clientRunId]
  );
  const startStreamHeaders = useMemo(() => ({'X-CSRFToken': getCsrfToken()}), []);

  const stream = useStream<AgenticProgressRun>({
    enabled: queryEnabled && startStreamData !== undefined,
    orgId: Number(organization.id),
    startStreamUrl: getApiUrl(
      '/organizations/$organizationIdOrSlug/onboarding/agent/runs/',
      {path: {organizationIdOrSlug: organization.slug}}
    ),
    startStreamData,
    startStreamHeaders,
    onConnect: () => setStreamConnected(true),
    onClose: () => setStreamConnected(false),
    onMessage: snapshot => {
      if (snapshot.runId !== runId) {
        return;
      }

      setData(current =>
        current && current.sequence >= snapshot.sequence ? current : snapshot
      );
    },
    onError: () => {
      setStreamConnected(false);
      void refetch();
    },
  });

  return {
    data: data?.runId === runId ? data : undefined,
    error: stream.error ?? query.error,
    isConnected: stream.isConnected,
    isPending: query.isPending,
    refetch,
  };
}
