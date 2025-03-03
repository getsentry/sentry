import {useEffect} from 'react';
import type {BrowserClientReplayOptions} from '@sentry/core';
import type {replayIntegration} from '@sentry/react';
import {getClient} from '@sentry/react';

import {isStaticString} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useUser} from 'sentry/utils/useUser';

interface Props {
  organization: Organization | null;
}

// Single replayRef across the whole app, even if this hook is called multiple times
let replayRef: ReturnType<typeof replayIntegration> | null;

/**
 * Load the Sentry Replay integration based on the feature flag.
 *
 *  Can't use `useOrganization` because it throws on
 * `/settings/account/api/auth-token/` because organization is not *immediately*
 * set in context
 */
export default function useReplayInit({organization}: Props) {
  const user = useUser();

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
            isStaticString(text) ? text : text.replace(/[\S]/g, '*'),

          slowClickIgnoreSelectors: [
            '[aria-label*="download" i]',
            '[aria-label*="export" i]',
          ],
        });

        if (organization?.features.includes('session-replay-enable-canvas')) {
          const {replayCanvasIntegration} = await import('@sentry/react');
          client.addIntegration!(replayCanvasIntegration());
        }

        client.addIntegration!(replayRef);
      }
    }

    if (process.env.NODE_ENV !== 'production' || process.env.IS_ACCEPTANCE_TEST) {
      return;
    }

    if (!organization || !user) {
      return;
    }

    const sessionSampleRate = user.isStaff ? 1.0 : 0.05;
    const errorSampleRate = 0.5;

    init(sessionSampleRate, errorSampleRate);

    // NOTE: if this component is unmounted (e.g. when org is switched), we will continue to record!
    // This can be changed by calling `stop/start()` on unmount/mount respectively.
  }, [organization, user]);
}
