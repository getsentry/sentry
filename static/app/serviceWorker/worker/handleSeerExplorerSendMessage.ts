import {workerFetch} from 'sentry/serviceWorker/worker/fetch';
import {showNotification} from 'sentry/serviceWorker/worker/showNotification';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export interface SeerExplorerSendMessageData {
  notification: {
    body: {
      error: string;
      success: string;
    };
    icon: string;
    navigateTo: {
      pathname: string;
      query?: Record<string, string>;
    };
    title: {
      error: string;
      success: string;
    };
  };
  organizationIdOrSlug: string;
  runId: string;
}

/**
 * Minimal shape of the explorer-chat endpoint response. The full types live in
 * `sentry/views/seerExplorer/types`, but importing them would pull the app
 * bundle into the worker.
 */
interface SeerExplorerPollResponse {
  session: {
    blocks: Array<{loading?: boolean}>;
    status: string;
    updated_at: string;
    failure_reason?: string | null;
    repo_pr_states?: Record<string, {pr_creation_status?: string | null}>;
  } | null;
}

type Session = NonNullable<SeerExplorerPollResponse['session']>;

/** How long to wait between polls, in milliseconds. */
const POLL_INTERVAL_MS = 2_000;

/**
 * Safety cap so a stuck run can never keep the worker polling forever. Explorer
 * runs can be long, so this is generous.
 */
const MAX_POLL_DURATION_MS = 15 * 60 * 1_000;

/**
 * Service workers can be suspended (or killed and later resumed) at any time,
 * so wall-clock time can jump forward between polls. If the run finished more
 * than this long ago the result is no longer relevant, so we skip the
 * notification rather than surfacing a stale "Seer replied".
 */
const STALE_RESULT_MS = 5 * 60 * 1_000;

/**
 * The run is not always marked `processing` by the time the send request
 * resolves, so an early poll can still describe the *previous* turn and would
 * notify immediately with the wrong result. Within this window a finished
 * reading is ignored until we have seen the new turn actually start. After it
 * we trust the status, so a run that finishes very fast is notified late rather
 * than not at all.
 */
const START_GRACE_MS = 10_000;

/**
 * The generation of the most recent poll loop per run. All loops share the
 * worker's module scope, so when a new message is sent for a run we bump its
 * generation; any older loop still polling for that run notices its generation
 * is stale and stops. A newer message means the older turn is superseded and
 * another loop now owns polling, and the notification.
 */
const latestPollGeneration = new Map<string, number>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * The endpoint returns timestamps with no zone marker. Parsing one as-is would
 * make the browser read it as local time and throw the staleness check off by
 * the user's UTC offset.
 */
function parseUtcTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const withZone = /Z|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(value) ? value : `${value}Z`;
  const time = new Date(withZone).getTime();
  return isNaN(time) ? null : time;
}

/**
 * Mirrors `isResponseComplete` in `useSeerExplorerPolling`: the agent is done
 * only once the run has left `processing`, every block has settled, and no pull
 * request is still being created.
 */
function isRunComplete(session: Session): boolean {
  return (
    session.status !== 'processing' &&
    session.blocks.every(block => !block.loading) &&
    Object.values(session.repo_pr_states ?? {}).every(
      state => state.pr_creation_status !== 'creating'
    )
  );
}

function isRunErrored(session: Session): boolean {
  return session.status === 'error' || Boolean(session.failure_reason);
}

/**
 * Poll the explorer-chat endpoint until the agent has finished replying, then
 * fire a browser notification.
 */
export async function handleSeerExplorerSendMessage(
  sw: ServiceWorkerGlobalScope,
  {organizationIdOrSlug, runId, notification}: SeerExplorerSendMessageData
): Promise<void> {
  // Claim the newest generation for this run. Any older loop still running will
  // see its generation is stale and stop.
  const generation = (latestPollGeneration.get(runId) ?? 0) + 1;
  latestPollGeneration.set(runId, generation);

  const path = getApiUrl(
    '/organizations/$organizationIdOrSlug/seer/explorer-chat/$runId/',
    {path: {organizationIdOrSlug, runId}}
  );

  const startedAt = Date.now();
  const deadline = startedAt + MAX_POLL_DURATION_MS;
  let hasSeenRunStart = false;

  try {
    while (Date.now() < deadline) {
      // A newer message was sent for this run (a newer loop now owns polling),
      // so stop here without notifying to avoid a duplicate notification.
      if (latestPollGeneration.get(runId) !== generation) {
        return;
      }

      const response = await workerFetch(path, {});
      const body: SeerExplorerPollResponse = await response.json();
      const session = body.session;

      if (session) {
        const isComplete = isRunComplete(session);

        if (!isComplete) {
          hasSeenRunStart = true;
        }

        const isTrustworthy = hasSeenRunStart || Date.now() - startedAt >= START_GRACE_MS;

        if (isComplete && isTrustworthy) {
          const updatedAt = parseUtcTimestamp(session.updated_at);
          if (updatedAt !== null && Date.now() - updatedAt > STALE_RESULT_MS) {
            return;
          }

          const outcome = isRunErrored(session) ? 'error' : 'success';

          await showNotification(sw, {
            title: notification.title[outcome],
            options: {
              body: notification.body[outcome],
              icon: notification.icon,
              badge: notification.icon,
              tag: `seer-explorer-${runId}`,
              renotify: true,
              data: {
                organizationIdOrSlug,
                runId,
                status: session.status,
                navigateTo: notification.navigateTo,
              },
            },
          });
          return;
        }
      }

      await delay(POLL_INTERVAL_MS);
    }
  } finally {
    // Release ownership only if we still hold it; if we were superseded the
    // newer loop owns this entry and must keep it.
    if (latestPollGeneration.get(runId) === generation) {
      latestPollGeneration.delete(runId);
    }
  }
}
