import {workerFetch} from 'sentry/serviceWorker/worker/fetch';
import {showNotification} from 'sentry/serviceWorker/worker/showNotification';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

// Clone of sentry/components/events/autofix/useExplorerAutofix
type AutofixExplorerStep = 'root_cause' | 'solution' | 'code_changes' | 'pr_iteration';

export interface AutofixStartStepData {
  issueId: string;
  notification: {
    body: {
      error: string;
      success: string;
    };
    navigateTo: {
      pathname: string;
      query?: Record<string, string>;
    };
    project: {
      avatar: string;
    };
    title: {
      error: string;
      success: string;
    };
  };
  organizationIdOrSlug: string;
  step: AutofixExplorerStep;
  stepOptions: {
    insertIndex?: number;
    runId?: number | string;
    userContext?: string;
  };
}

/**
 * Minimal shape of the autofix endpoint response. We intentionally avoid
 * importing the full `ExplorerAutofixState` type from the app bundle so the
 * worker bundle doesn't pull in React / react-query.
 */
interface AutofixPollResponse {
  autofix: {status: string; updated_at?: string} | null;
}

/** How long to wait between polls, in milliseconds. */
const POLL_INTERVAL_MS = 2_000;

/**
 * Safety cap so a stuck run can never keep the worker polling forever. Autofix
 * runs are long, so this is generous.
 */
const MAX_POLL_DURATION_MS = 15 * 60 * 1_000;

/**
 * Service workers can be suspended (or killed and later resumed) at any time,
 * so wall-clock time can jump forward between polls. If the run finished more
 * than this long ago, the result is no longer relevant to the user and we skip
 * the notification rather than surfacing a stale "Autofix finished" toast.
 */
const STALE_RESULT_MS = 5 * 60 * 1_000;

/**
 * The generation of the most recent poll loop per issue. All loops share the
 * worker's module scope, so when a new step starts for an issue we bump its
 * generation; any older loop still polling for that issue notices its
 * generation is stale and stops. Autofix steps run sequentially per issue, so a
 * newer step means the older one is superseded and another loop now owns
 * polling (and the notification).
 */
const latestPollGeneration = new Map<string, number>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Poll the autofix endpoint until the run is no longer processing, then fire a
 * browser notification.
 */
export async function handleAutofixStartStep(
  sw: ServiceWorkerGlobalScope,
  {organizationIdOrSlug, issueId, notification}: AutofixStartStepData
): Promise<void> {
  // Claim the newest generation for this issue. Any older loop still running
  // will see its generation is stale and stop.
  const generation = (latestPollGeneration.get(issueId) ?? 0) + 1;
  latestPollGeneration.set(issueId, generation);

  const path = getApiUrl(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
    {path: {organizationIdOrSlug, issueId}}
  );

  const deadline = Date.now() + MAX_POLL_DURATION_MS;

  try {
    while (Date.now() < deadline) {
      // A newer step started for this issue (a newer loop now owns polling), so
      // stop here without notifying to avoid a duplicate notification.
      if (latestPollGeneration.get(issueId) !== generation) {
        return;
      }

      const response = await workerFetch(path, {mode: 'explorer'});

      if (!response.ok) {
        throw new Error(`Autofix poll failed with status ${response.status}`);
      }

      const body: AutofixPollResponse = await response.json();
      const status = body.autofix?.status;

      if (status && status !== 'processing') {
        const updatedAt = body.autofix?.updated_at;
        const resultAgeMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : 0;

        if (resultAgeMs > STALE_RESULT_MS) {
          return;
        }

        await showNotification(sw, {
          title: notification.title[status === 'error' ? 'error' : 'success'],
          options: {
            body: notification.body[status === 'error' ? 'error' : 'success'],
            icon: notification.project.avatar,
            badge: notification.project.avatar,
            image: notification.project.avatar,
            tag: `autofix-${issueId}`,
            renotify: true,
            data: {
              organizationIdOrSlug,
              issueId,
              status,
              navigateTo: notification.navigateTo,
            },
          },
        });
        return;
      }

      await delay(POLL_INTERVAL_MS);
    }
  } finally {
    // Release ownership only if we still hold it; if we were superseded the
    // newer loop owns this entry and must keep it.
    if (latestPollGeneration.get(issueId) === generation) {
      latestPollGeneration.delete(issueId);
    }
  }
}
