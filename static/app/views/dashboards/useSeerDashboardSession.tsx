import {useCallback, useEffect, useRef, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

import {extractDashboardFromSession, statusIsTerminal} from './createFromSeerUtils';
import type {DashboardDetails, Widget} from './types';

const POLL_INTERVAL_MS = 500;
const POST_COMPLETE_POLL_MS = 5000;

async function startDashboardEditSession(
  orgSlug: string,
  message: string,
  dashboard: Pick<DashboardDetails, 'title' | 'widgets'>
): Promise<number> {
  const url = getApiUrl('/organizations/$organizationIdOrSlug/dashboards/generate/', {
    path: {organizationIdOrSlug: orgSlug},
  });
  const response = await fetchMutation<{run_id: string}>({
    url,
    method: 'POST',
    data: {
      prompt: message,
      current_dashboard: {
        title: dashboard.title,
        widgets: dashboard.widgets,
      },
    },
  });
  return Number(response.run_id);
}

interface UseSeerDashboardSessionOptions {
  onDashboardUpdate: (
    data: {title: string; widgets: Widget[]},
    seerRunId: number | null
  ) => void;
  dashboard?: Pick<DashboardDetails, 'title' | 'widgets'>;
  enabled?: boolean;
  onPostCompletePollEnd?: () => void;
  seerRunId?: number | null;
}

interface UseSeerDashboardSessionResult {
  isError: boolean;
  isUpdating: boolean;
  sendFollowUpMessage: (message: string) => Promise<void>;
  session: SeerExplorerResponse['session'] | undefined;
  setIsUpdating: (updating: boolean) => void;
}

/**
 * Hook that encapsulates polling a Seer Explorer session for dashboard artifacts,
 * detecting terminal-state transitions, and sending follow-up messages.
 */
export function useSeerDashboardSession({
  seerRunId: externalSeerRunId,
  dashboard,
  onDashboardUpdate,
  enabled = true,
  onPostCompletePollEnd,
}: UseSeerDashboardSessionOptions): UseSeerDashboardSessionResult {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const [internalRunId, setInternalRunId] = useState<number | null>(null);
  const seerRunId = externalSeerRunId ?? internalRunId;

  const [isUpdating, setIsUpdating] = useState(false);

  const prevSessionStatusRef = useRef<{
    status: string | null;
    updated_at: string | null;
  }>({status: null, updated_at: null});
  const completedAtRef = useRef<number | null>(null);

  const {data, isError} = useApiQuery<SeerExplorerResponse>(
    makeSeerExplorerQueryKey(organization.slug, seerRunId),
    {
      staleTime: 0,
      retry: false,
      enabled: !!seerRunId && enabled,
      refetchInterval: query => {
        const status = query.state.data?.[0]?.session?.status;
        if (statusIsTerminal(status)) {
          if (completedAtRef.current === null) {
            completedAtRef.current = Date.now();
          }
          if (Date.now() - completedAtRef.current < POST_COMPLETE_POLL_MS) {
            return POLL_INTERVAL_MS;
          }
          onPostCompletePollEnd?.();
          return false;
        }
        completedAtRef.current = null;
        return POLL_INTERVAL_MS;
      },
    }
  );

  const session = data?.session;
  const sessionStatus = session?.status ?? null;
  const sessionUpdatedAt = session?.updated_at ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }
    const prevUpdatedAt = prevSessionStatusRef.current.updated_at;
    const prevStatus = prevSessionStatusRef.current.status;
    prevSessionStatusRef.current = {
      status: sessionStatus,
      updated_at: sessionUpdatedAt,
    };

    const isTerminal = statusIsTerminal(sessionStatus);
    const wasTerminal = statusIsTerminal(prevStatus);

    // Update states when transitioning from non-terminal to terminal session
    if (prevUpdatedAt !== sessionUpdatedAt && isTerminal && !wasTerminal) {
      if (isUpdating) {
        setIsUpdating(false);
      }
      const dashboardData = extractDashboardFromSession(session);
      if (dashboardData) {
        onDashboardUpdate(dashboardData, seerRunId);
      }
    }
  }, [
    isUpdating,
    sessionStatus,
    session,
    sessionUpdatedAt,
    onDashboardUpdate,
    seerRunId,
  ]);

  const sendFollowUpMessage = useCallback(
    async (message: string) => {
      if (!seerRunId && !dashboard) {
        return;
      }
      setIsUpdating(true);
      completedAtRef.current = null;
      const errorMessage = t('Failed to send message');
      try {
        if (!seerRunId && dashboard) {
          // No session exists yet and an initial dashboard is provided, start a new Seer session
          const runId = await startDashboardEditSession(
            organization.slug,
            message,
            dashboard
          );
          if (!runId) {
            throw new Error('Failed to start dashboard editing session');
          }
          setInternalRunId(runId);
        } else {
          // A session exists, send the message to the existing session
          const queryKey = makeSeerExplorerQueryKey(organization.slug, seerRunId);
          const {url} = parseQueryKey(queryKey);
          await fetchMutation({
            url,
            method: 'POST',
            data: {query: message},
          });
          queryClient.invalidateQueries({queryKey});
        }
      } catch {
        setIsUpdating(false);
        addErrorMessage(errorMessage);
      }
    },
    [organization.slug, queryClient, seerRunId, dashboard]
  );

  return {
    session,
    isUpdating,
    setIsUpdating,
    isError,
    sendFollowUpMessage,
  };
}
