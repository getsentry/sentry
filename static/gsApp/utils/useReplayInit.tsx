import {useEffect, useState} from 'react';
import type {BrowserClientReplayOptions} from '@sentry/core';
import type {replayIntegration} from '@sentry/react';
import {getClient} from '@sentry/react';

import {isStaticString} from 'sentry/locale';
import {useUser} from 'sentry/utils/useUser';

// Single replayRef across the whole app, even if this hook is called multiple times
let replayRef: ReturnType<typeof replayIntegration> | null = null;
// Subscribers waiting for replayRef to become non-null. Needed because
// useReplayReady can be mounted around the same async init that
// useReplayInit drives: the initiator's `setReady` only updates its own
// component, so other subscribers have to be notified explicitly.
const readyListeners = new Set<() => void>();

/**
 * Subscribe to whether the Sentry Replay integration has been registered.
 *
 * Use this when a component needs to wait for `Sentry.getReplay()` to
 * return non-null (e.g. before flushing for a forced replay) but should
 * NOT drive registration itself. Registration happens at the App root
 * via `useReplayInit` mounted in the `component:replay-init` hook.
 */
export function useReplayReady(): boolean {
  // replayRef is assigned synchronously and there is no `await` between the
  // assignment and `client.addIntegration(replayRef)` (see useReplayInit),
  // so a non-null replayRef observed from any render means the integration
  // is registered and `Sentry.getReplay()` will return it.
  const [ready, setReady] = useState(() => replayRef !== null);

  useEffect(() => {
    if (replayRef) {
      // Integration was registered before this subscriber mounted; flip now.
      setReady(true);
      return;
    }
    // No integration yet. Subscribe so we get notified when init finishes.
    const listener = () => setReady(true);
    readyListeners.add(listener);
    return () => {
      readyListeners.delete(listener);
    };
  }, []);

  return ready;
}

/**
 * Load the Sentry Replay integration based on the feature flag.
 *
 * Mounted at the App root via the `component:replay-init` hook so
 * registration covers every route — including non-org routes like
 * `/onboarding/*`. Consumers that need to know when registration has
 * completed should call `useReplayReady`.
 */
export function useReplayInit(): boolean {
  const user = useUser();
  const ready = useReplayReady();

  useEffect(() => {
    async function init(sessionSampleRate: number, errorSampleRate: number) {
      const {replayIntegration} = await import('@sentry/react');

      if (!replayRef) {
        const client = getClient();

        if (!client) {
          return;
        }

        const options = client.getOptions() as BrowserClientReplayOptions;
        options.replaysSessionSampleRate = sessionSampleRate;
        options.replaysOnErrorSampleRate = errorSampleRate;

        replayRef = replayIntegration({
          maskAllText: true,
          _experiments: {
            captureExceptions: true,
            traceInternals: true,
          },
          networkDetailAllowUrls: ['/api/0/'],
          networkDetailDenyUrls: [
            '/api/0/customers/',
            '/api/0/invoices/',
            /\/api\/0\/projects\/[^/]*\/[^/]*\/replays\/[^/]*\/recording-segments\//,
          ],
          networkRequestHeaders: ['sentry-trace', 'origin'],
          networkResponseHeaders: [
            'access-control-allow-headers',
            'access-control-allow-methods',
            'access-control-allow-origin',
            'access-control-expose-headers',
            'allow',
            'link',
            'x-sentry-rate-limit-concurrentlimit',
            'x-sentry-rate-limit-concurrentremaining',
            'x-sentry-rate-limit-limit',
            'x-sentry-rate-limit-remaining',
            'x-sentry-rate-limit-reset',
            'x-served-by',
          ],
          maskFn: (text: string) =>
            isStaticString(text) ? text : text.replace(/\S/g, '*'),

          slowClickIgnoreSelectors: [
            '[aria-label*="download" i]',
            '[aria-label*="export" i]',
          ],
        });

        client.addIntegration(replayRef);
        // Notify any useReplayReady subscribers that the integration is ready.
        readyListeners.forEach(l => l());
      }
    }

    if (process.env.NODE_ENV !== 'production' || process.env.IS_ACCEPTANCE_TEST) {
      return;
    }

    if (!user) {
      return;
    }

    const sessionSampleRate = user.isStaff ? 1 : 0.05;
    const errorSampleRate = 1;

    init(sessionSampleRate, errorSampleRate);

    // NOTE: if this component is unmounted (e.g. when org is switched), we will continue to record!
    // This can be changed by calling `stop/start()` on unmount/mount respectively.
  }, [user]);

  return ready;
}
