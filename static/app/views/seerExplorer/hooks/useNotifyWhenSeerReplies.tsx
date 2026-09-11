import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import type {EventMessage} from 'sentry/serviceWorker/types';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {RUN_ID_QUERY_PARAM} from 'sentry/views/seerExplorer/utils';

/** Keep the notification body to roughly one line in the OS shade. */
const BODY_MAX_LENGTH = 120;

/**
 * `/favicon.ico` is a deliberate 404 in sentry's url conf and the bundled icon
 * is only served from a versioned `_static` path, so the notification points at
 * the marketing site's copy instead.
 */
const NOTIFICATION_ICON = 'https://sentry.io/favicon.ico';

/**
 * Ask the service worker to watch a run and raise a browser notification once
 * Seer has finished replying. The worker keeps polling after the tab is hidden
 * or closed, which is the whole point: a reply takes long enough that the user
 * is expected to go and do something else.
 */
export function useNotifyWhenSeerReplies() {
  // Matches the rest of the explorer hooks, which run on pages that have no
  // organization in context.
  const organization = useOrganization({allowNull: true});
  const {pathname} = useLocation();
  const {isServiceWorkerSupported, controller} = useServiceWorker();

  const orgSlug = organization?.slug;
  const isEnabled =
    Boolean(organization?.features.includes('seer-explorer-browser-notifications')) &&
    isServiceWorkerSupported;

  return useCallback(
    (runId: SeerExplorerRunId, query: string) => {
      if (!isEnabled || !orgSlug) {
        return;
      }

      controller
        .postMessage({
          type: 'event',
          name: 'seerExplorer.sendMessage',
          data: {
            organizationIdOrSlug: orgSlug,
            runId: String(runId),
            notification: {
              icon: NOTIFICATION_ICON,
              // Return to the page the question was asked from. The deep link
              // param reopens Seer on this run when it has since been closed.
              navigateTo: {
                pathname,
                query: {[RUN_ID_QUERY_PARAM]: String(runId)},
              },
              title: {
                success: t('Seer has an answer'),
                error: t('Seer ran into a problem'),
              },
              body: {
                success: ellipsize(query.trim(), BODY_MAX_LENGTH),
                error: t('Seer could not finish this request.'),
              },
            },
          },
        } satisfies EventMessage)
        .catch(error => {
          // Losing the notification is not worth interrupting the chat with a
          // toast; the user still sees the reply arrive in the panel.
          Sentry.captureException(error);
        });
    },
    [controller, isEnabled, orgSlug, pathname]
  );
}
