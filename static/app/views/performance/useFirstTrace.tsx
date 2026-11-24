import {useEffect, useEffectEvent, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';

const TRACE_POLL_INTERVAL_MS = 5_000;

// Page filters, such as an environment, can hide the first trace for good, so stop
// waiting eventually rather than keeping the user on the empty state.
const MAX_TRACE_WAIT_MS = 2 * 60 * 1000;

interface UseFirstTraceOptions {
  organization: Organization;
  project: Project;
  disabled?: boolean;
  /**
   * Called once the first trace can be queried, or once waiting for it times out.
   */
  onReady?: () => void;
}

/**
 * Waits for a project's first transaction, then for a trace to be queryable. The
 * project's first-transaction flag is set at ingest, before its spans can be queried.
 */
export function useFirstTrace({
  organization,
  project,
  disabled,
  onReady,
}: UseFirstTraceOptions) {
  const received = !!useEventWaiter({
    eventType: 'transaction',
    organization,
    project,
    disabled,
  });
  const [timedOut, setTimedOut] = useState(false);

  const tracesQuery = useQuery({
    ...useTracesApiOptions({limit: 1, sort: 'timestamp'}),
    enabled: received && !timedOut,
    refetchInterval: query =>
      query.state.data?.json?.data?.[0]?.trace ? false : TRACE_POLL_INTERVAL_MS,
  });
  const traceId = tracesQuery.data?.data[0]?.trace;

  useEffect(() => {
    if (!received || traceId) {
      return;
    }
    const timeout = window.setTimeout(() => setTimedOut(true), MAX_TRACE_WAIT_MS);
    return () => window.clearTimeout(timeout);
  }, [received, traceId]);

  const notifyReady = useEffectEvent(() => onReady?.());
  const isReady = !!traceId || timedOut;
  useEffect(() => {
    if (isReady) {
      notifyReady();
    }
  }, [isReady]);

  return {received, traceId};
}
