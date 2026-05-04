import {useEffect, useState} from 'react';
import type {BrowserClientReplayOptions} from '@sentry/core';
import type {replayIntegration} from '@sentry/react';
import {getClient} from '@sentry/react';

import {isStaticString} from 'sentry/locale';
import {useUser} from 'sentry/utils/useUser';

// Single replayRef across the whole app, even if this hook is called multiple times
let replayRef: ReturnType<typeof replayIntegration> | null;
// Subscribers waiting for replayRef to become non-null. Needed because two
// useReplayInit callers can be mounted around the same async init: the
// initiator's `setReady` only updates its own component, so the other caller
// has to subscribe to be notified when init resolves.
const readyListeners = new Set<() => void>();

/**
 * Load the Sentry Replay integration based on the feature flag.
 *
 * Returns `true` once the integration has been registered with the Sentry
 * client. Useful for callers that need to wait for `Sentry.getReplay()` to
 * become non-null before flushing (e.g. forced replays during onboarding,
 * which mounts outside `OrganizationLayout`).
 */
export function useReplayInit(): boolean {
  const user = useUser();
  // replayRef is assigned synchronously immediately before
  // `client.addIntegration(replayRef)` (see below), with no await between
  // them, so a non-null replayRef observed from any other render means the
  // integration is registered and `Sentry.getReplay()` will return it.
  const [ready, setReady] = useState(() => replayRef !== null);

  useEffect(() => {
    if (replayRef) {
      // Integration was registered before this caller mounted; flip now.
      setReady(true);
      return;
    }
    // No integration yet. Subscribe so we get notified when whichever
    // caller is currently running init() finishes registration.
    const listener = () => setReady(true);
    readyListeners.add(listener);
    return () => {
      readyListeners.delete(listener);
    };
  }, []);

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
        // Notify any subscribers (other useReplayInit callers that mounted
        // while this init was in flight) that the integration is ready.
        readyListeners.forEach(l => l());
      }
    }

    if (process.env.NODE_ENV !== 'production' || process.env.IS_ACCEPTANCE_TEST) {
      return;
    }

    if (!user) {
      return;
    }

    const sessionSampleRate = user.isStaff ? 1.0 : 0.05;
    const errorSampleRate = 1.0;

    init(sessionSampleRate, errorSampleRate);

    // NOTE: if this component is unmounted (e.g. when org is switched), we will continue to record!
    // This can be changed by calling `stop/start()` on unmount/mount respectively.
  }, [user]);

  return ready;
}
