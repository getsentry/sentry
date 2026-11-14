import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {SentryApp, SentryAppInstallation} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

export function sentryAppInstallationsApiOptions({orgSlug}: {orgSlug: string}) {
  return apiOptions.as<SentryAppInstallation[]>()(
    '/organizations/$organizationIdOrSlug/sentry-app-installations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    }
  );
}

/**
 * Install a sentry application
 *
 * @param {Object} client ApiClient
 * @param {String} orgId Organization Slug
 * @param {Object} app SentryApp
 */
export function installSentryApp(
  client: Client,
  orgId: string,
  app: SentryApp
): Promise<SentryAppInstallation> {
  toast.loading(t('Saving changes...'));
  const promise = client.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/sentry-app-installations/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      method: 'POST',
      data: {slug: app.slug},
    }
  );
  promise.then(
    () => toast.dismiss(),
    () => toast.error(t('Unable to install %s', app.name))
  );
  return promise;
}

/**
 * Uninstall a sentry application
 *
 * @param {Object} client ApiClient
 * @param {Object} install SentryAppInstallation
 */
export function uninstallSentryApp(
  client: Client,
  install: SentryAppInstallation
): Promise<void> {
  toast.loading(t('Saving changes...'));
  const promise = client.requestPromise(`/sentry-app-installations/${install.uuid}/`, {
    method: 'DELETE',
  });
  const capitalizedAppSlug =
    install.app.slug.charAt(0).toUpperCase() + install.app.slug.slice(1);
  promise.then(
    () => {
      toast.success(t('%s successfully queued for deletion.', capitalizedAppSlug));
    },
    () => toast.dismiss()
  );
  return promise;
}
