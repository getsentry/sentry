import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface PollPhaseConfig {
  /**
   * How long to remain in this phase before advancing to the next, or timing
   * out if last.
   */
  phaseTimeout: number;
  /**
   * Milliseconds between polls during this phase.
   */
  pollInterval: number;
  /**
   * Toast shown when this phase ends and the next one begins. Not shown for
   * the final phase, which triggers the timeout error instead.
   */
  transitionToast?: string;
}

interface UsePhaseTimerOptions {
  onTimeout: () => void;
}

interface UsePhaseTimerResult {
  cancel: () => void;
  currentPhase: PollPhaseConfig | null;
  start: () => void;
}

/**
 * Manages  multi-phase timer progression. Each phase runs for `phaseTimeout`
 * ms before either advancing to the next phase (showing `transitionToast` if
 * set) or calling `onTimeout` when the last phase expires.
 */
function usePhaseTimer(
  config: PollPhaseConfig[],
  {onTimeout}: UsePhaseTimerOptions
): UsePhaseTimerResult {
  const [phaseIndex, setPhaseIndex] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Stored in a ref to allow recursion without useCallback deps.
  const scheduleRef = useRef<(idx: number) => void>(() => {});
  scheduleRef.current = (idx: number) => {
    const phase = configRef.current[idx];
    if (!phase) return;

    timerRef.current = window.setTimeout(() => {
      const nextIdx = idx + 1;
      if (nextIdx < configRef.current.length) {
        if (phase.transitionToast) {
          addLoadingMessage(phase.transitionToast);
        }
        setPhaseIndex(nextIdx);
        scheduleRef.current(nextIdx);
      } else {
        timerRef.current = null;
        setPhaseIndex(null);
        onTimeoutRef.current();
      }
    }, phase.phaseTimeout);
  };

  function start() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setPhaseIndex(0);
    scheduleRef.current(0);
  }

  function cancel() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPhaseIndex(null);
  }

  useEffect(() => {
    const timer = timerRef;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const currentPhase = phaseIndex === null ? null : (config[phaseIndex] ?? null);

  return {start, cancel, currentPhase};
}

interface SyncState {
  /**
   * Are we waiting for an integration installation to have synced?
   */
  isSyncing: boolean;
  /**
   * Kicks off a repository sync for this integration. Records the current
   * `last_sync` value, fires the POST, then polls until `last_sync` changes
   * or all polling phases are exhausted. Undefined while the integration
   * query is loading or a sync is already in progress.
   */
  syncNow: (() => void) | undefined;
}

interface Options {
  /**
   * Called when a sync completes successfully.
   * Use to trigger a repository list refresh.
   */
  onSynced?: () => void;
  /**
   * Polling phases to work through before giving up. Each phase defines how
   * frequently to poll and how long to stay in that phase. Defaults to a
   * two-phase backoff: every 5 seconds for 30 seconds, then every 30 seconds
   * for 4.5 minutes (5 minutes total).
   */
  pollingConfig?: PollPhaseConfig[];
}

/**
 * Default two-phase backoff: poll aggressively for the first 30 seconds,
 * then slow down to every 30 seconds for up to 4.5 more minutes (5 min total).
 */
const DEFAULT_POLLING_CONFIG = [
  {
    pollInterval: 5_000,
    phaseTimeout: 30_000,
    transitionToast: t('Repositories still syncing, this may take a few minutes'),
  },
  {
    pollInterval: 30_000,
    phaseTimeout: 60_000 * 4.5,
  },
] as const satisfies PollPhaseConfig[];

/**
 * Manages repository sync state for a single integration. Returns an
 * `isSyncing` flag and a `syncNow` callback. Polling and timeout handling
 * are managed internally via configurable phases.
 */
export function useSyncRepositories(
  integration: OrganizationIntegration,
  options?: Options
): SyncState {
  const organization = useOrganization();

  const integrationId = integration.id;
  const organizationIdOrSlug = organization.slug;

  const pollingConfig = options?.pollingConfig ?? DEFAULT_POLLING_CONFIG;

  const [lastSyncBefore, setLastSyncBefore] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);

  const onSyncedRef = useRef(options?.onSynced);
  onSyncedRef.current = options?.onSynced;

  function startSyncing() {
    setIsSyncing(true);
    addLoadingMessage(t('Repository sync started, this may take a few moments'));
  }

  function stopSyncing() {
    setIsSyncing(false);
    setLastSyncBefore(undefined);
  }

  const phaseTimer = usePhaseTimer(pollingConfig, {
    onTimeout: () => {
      stopSyncing();
      addErrorMessage(
        t('Repositories still syncing — giving up polling. Come back later to check.')
      );
    },
  });

  const phaseTimerRef = useRef(phaseTimer);
  phaseTimerRef.current = phaseTimer;

  const query = useQuery({
    ...apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: {organizationIdOrSlug, integrationId},
        // Drop staleTime to zero while syncing so refetches return fresh data.
        staleTime: isSyncing ? 0 : 60_000,
      }
    ),
    refetchInterval: phaseTimer.currentPhase?.pollInterval ?? false,
  });

  // Detect sync completion by comparing last_sync on each poll result.
  useEffect(() => {
    if (!isSyncing || !query.data) return;

    const currentLastSync = query.data.configData?.last_sync as string | undefined;
    if (currentLastSync !== lastSyncBefore) {
      phaseTimerRef.current.cancel();
      stopSyncing();
      addSuccessMessage(t('Repositories synced successfully'));
      onSyncedRef.current?.();
    }
  }, [query.data, isSyncing, lastSyncBefore]);

  // syncNow is undefined while the query is loading or a sync is in progress,
  // guaranteeing that lastSyncBefore is always captured from real data.
  const syncNow =
    query.data && !isSyncing
      ? () => {
          setLastSyncBefore(query.data.configData?.last_sync as string | undefined);
          startSyncing();
          phaseTimerRef.current.start();

          fetchMutation({
            method: 'POST',
            url: getApiUrl(
              '/organizations/$organizationIdOrSlug/integrations/$integrationId/repo-sync/',
              {
                path: {organizationIdOrSlug, integrationId},
              }
            ),
          })
            .then(() => {
              query.refetch();
            })
            .catch(() => {
              phaseTimerRef.current.cancel();
              stopSyncing();
              addErrorMessage(t('Failed to start repository sync'));
            });
        }
      : undefined;

  return {syncNow, isSyncing};
}
