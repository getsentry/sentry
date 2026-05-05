import {useEffect, useMemo, useReducer, useRef} from 'react';
import {useQueries} from '@tanstack/react-query';
import type {UseQueryResult} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type SyncingState = {
  lastSyncBefore: string | undefined;
};

type SyncAction =
  | {integrationId: string; lastSyncBefore: string | undefined; type: 'start'}
  | {integrationId: string; type: 'complete'}
  | {integrationId: string; type: 'timeout'}
  | {integrationId: string; type: 'error'};

function syncReducer(
  state: Record<string, SyncingState>,
  action: SyncAction
): Record<string, SyncingState> {
  switch (action.type) {
    case 'start':
      return {...state, [action.integrationId]: {lastSyncBefore: action.lastSyncBefore}};
    case 'complete':
    case 'timeout':
    case 'error': {
      const next = {...state};
      delete next[action.integrationId];
      return next;
    }
    default:
      return state;
  }
}

export interface SyncState {
  /**
   * True from the moment `syncNow` is called until the sync completes,
   * times out, or errors.
   */
  isSyncing: boolean;
  /**
   * Kicks off a repository sync for this integration. Records the current
   * `last_sync` value, fires the POST, then polls until `last_sync` changes
   * or the timeout elapses.
   */
  syncNow: () => void;
}

interface Options {
  /**
   * Called when a sync completes successfully for a specific integration.
   * Use to trigger a repository list refresh.
   */
  onSynced?: (integration: OrganizationIntegration) => void;
  /**
   * How long to wait for `last_sync` to change before giving up. Defaults to
   * 30 seconds.
   */
  timeoutMs?: number;
}

/**
 * Manages per-integration repository sync state. Returns a map of integration
 * ID to `SyncState`, which includes an `isSyncing` flag and a `syncNow`
 * callback. Polling and timeout handling are managed internally.
 */
export function useSyncRepositories(
  integrations: OrganizationIntegration[],
  options?: Options
): Record<string, SyncState> {
  const organization = useOrganization();
  const {timeoutMs = 30_000} = options ?? {};

  // Tracks integrations currently in-flight: maps integration ID to the
  // pre-sync `last_sync` value so the polling effect can detect when it changes.
  const [syncingById, dispatch] = useReducer(syncReducer, {});

  // Use a ref so the effect below doesn't need onSynced as a dependency
  const onSyncedRef = useRef(options?.onSynced);
  onSyncedRef.current = options?.onSynced;

  // Timeout timers are side-effect objects — store in a ref, not state.
  const timeoutTimersRef = useRef<Record<string, number>>({});

  // Holds the latest query results so syncNow() closures read fresh data.
  const queriesByIdRef = useRef<
    Record<string, UseQueryResult<OrganizationIntegration, Error>>
  >({});

  const queriesById = useQueries({
    queries: integrations.map(integration => ({
      ...apiOptions.as<OrganizationIntegration>()(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration.id,
          },
          // Drop staleTime to zero while syncing so refetches return fresh data.
          staleTime: syncingById[integration.id] ? 0 : 60_000,
        }
      ),
      refetchInterval: syncingById[integration.id] ? 5_000 : false,
    })),
    combine: results =>
      Object.fromEntries(
        integrations.map((integration, i) => [integration.id, results[i]!])
      ),
  });

  queriesByIdRef.current = queriesById;

  // Detect sync completion by comparing last_sync on each poll result.
  useEffect(() => {
    const integrationsById = Object.fromEntries(integrations.map(i => [i.id, i]));

    for (const [integrationId, syncingState] of Object.entries(syncingById)) {
      const integration = integrationsById[integrationId];
      if (!integration) {
        dispatch({type: 'complete', integrationId});
        continue;
      }

      const data = queriesById[integrationId]?.data;
      if (!data) continue;

      const currentLastSync = data.configData?.['last_sync'] as string | undefined;
      if (currentLastSync !== syncingState.lastSyncBefore) {
        clearTimeout(timeoutTimersRef.current[integrationId]);
        delete timeoutTimersRef.current[integrationId];
        dispatch({type: 'complete', integrationId});
        addSuccessMessage(t('Repositories synced successfully'));
        onSyncedRef.current?.(integration);
      }
    }
  }, [queriesById, syncingById, integrations]);

  // Cancel any pending timeout timers when the hook unmounts.
  useEffect(() => {
    const timers = timeoutTimersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  return useMemo(() => {
    const entries = integrations.map(integration => {
      function syncNow() {
        const lastSyncBefore = queriesByIdRef.current[integration.id]?.data?.configData?.[
          'last_sync'
        ] as string | undefined;

        const timeoutTimer = window.setTimeout(() => {
          delete timeoutTimersRef.current[integration.id];
          dispatch({type: 'timeout', integrationId: integration.id});
          addErrorMessage(t('Repository sync timed out'));
        }, timeoutMs);

        timeoutTimersRef.current[integration.id] = timeoutTimer;
        dispatch({type: 'start', integrationId: integration.id, lastSyncBefore});

        fetchMutation({
          method: 'POST',
          url: getApiUrl(
            '/organizations/$organizationIdOrSlug/integrations/$integrationId/repo-sync/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                integrationId: integration.id,
              },
            }
          ),
        }).catch(() => {
          clearTimeout(timeoutTimersRef.current[integration.id]);
          delete timeoutTimersRef.current[integration.id];
          dispatch({type: 'error', integrationId: integration.id});
          addErrorMessage(t('Failed to start repository sync'));
        });
      }

      return [integration.id, {isSyncing: !!syncingById[integration.id], syncNow}];
    });

    return Object.fromEntries(entries);
  }, [integrations, syncingById, organization.slug, timeoutMs]);
}
