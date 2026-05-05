import {skipToken} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function sentryAppsApiOptions({
  orgSlug,
  status,
}: {
  orgSlug: string;
  status?: 'internal' | 'published' | 'unpublished';
}) {
  return apiOptions.as<SentryApp[]>()(
    '/organizations/$organizationIdOrSlug/sentry-apps/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: status ? {status} : undefined,
      staleTime: 0,
    }
  );
}

export function sentryAppApiOptions({appSlug}: {appSlug: string | null}) {
  return apiOptions.as<SentryApp>()('/sentry-apps/$sentryAppIdOrSlug/', {
    path: appSlug ? {sentryAppIdOrSlug: appSlug} : skipToken,
    staleTime: 0,
  });
}

/**
 * Remove a Sentry Application
 *
 * @param {Object} client ApiClient
 * @param {Object} app SentryApp
 */
export function removeSentryApp(client: Client, app: SentryApp): Promise<undefined> {
  addLoadingMessage();
  const promise = client.requestPromise(`/sentry-apps/${app.slug}/`, {
    method: 'DELETE',
  });
  promise.then(
    () => {
      addSuccessMessage(t('%s successfully removed.', app.slug));
    },
    () => {
      clearIndicators();
      addErrorMessage(t('Unable to remove %s integration', app.slug));
    }
  );
  return promise;
}
