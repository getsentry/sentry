import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {showNotification} from 'sentry/serviceWorker/worker/showNotification';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export interface AutofixStartStepData {
  issueId: string;
  organizationIdOrSlug: string;
  step: AutofixExplorerStep;
  insertIndex?: number;
  runId?: number;
  userContext?: string;
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Poll the autofix endpoint until the run is no longer processing, then fire a
 * browser notification.
 *
 * This runs inside the service worker, so we call `fetch()` directly instead of
 * the usual react-query / `requestPromise()` helpers, and prefix the path with
 * the `/api/0` API base ourselves.
 */
export function handleAutofixStartStep(
  sw: ServiceWorkerGlobalScope,
  data: AutofixStartStepData
): Promise<void> {
  return pollAutofixUntilDone(sw, {
    organizationIdOrSlug: data.organizationIdOrSlug,
    issueId: data.issueId,
  });
}

async function pollAutofixUntilDone(
  sw: ServiceWorkerGlobalScope,
  {organizationIdOrSlug, issueId}: {issueId: string; organizationIdOrSlug: string}
): Promise<void> {
  const path = getApiUrl(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
    {path: {organizationIdOrSlug, issueId}}
  );
  const url = `/api/0${path}?mode=explorer`;

  const deadline = Date.now() + MAX_POLL_DURATION_MS;

  // TODO: temporary logging to observe the polling loop in the console.
  /* eslint-disable no-console */
  console.log('[autofix-poll] start', {url, deadline});

  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const response = await fetch(url, {
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
    });

    if (!response.ok) {
      console.log('[autofix-poll] request failed', {attempt, status: response.status});
      throw new Error(`Autofix poll failed with status ${response.status}`);
    }

    const body: AutofixPollResponse = await response.json();
    const status = body.autofix?.status;

    console.log('[autofix-poll] tick', {attempt, status});

    if (status && status !== 'processing') {
      const updatedAt = body.autofix?.updated_at;
      const resultAgeMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : 0;

      if (resultAgeMs > STALE_RESULT_MS) {
        console.log('[autofix-poll] result is stale, skipping notification', {
          attempt,
          status,
          resultAgeMs,
        });
        return;
      }

      console.log('[autofix-poll] done, showing notification', {attempt, status});
      await showNotification(sw, {
        title: 'Autofix finished',
        options: {
          body:
            status === 'error'
              ? 'The autofix run ended with an error.'
              : 'Your autofix run is ready to review.',
          tag: `autofix-${issueId}`,
          data: {
            organizationIdOrSlug,
            issueId,
            status,
            to: `/${organizationIdOrSlug}/issues/${issueId}`,
          },
        },
      });
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  console.log('[autofix-poll] deadline reached, giving up', {attempt});
  /* eslint-enable no-console */
}
