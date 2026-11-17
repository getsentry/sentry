import * as Sentry from '@sentry/react';

import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import type {Monitor, ProcessingErrorType} from 'sentry/views/insights/crons/types';

function getMonitorUrl(orgId: string, projectId: string, monitorId: string) {
  return getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/',
    {
      path: {
        organizationIdOrSlug: orgId,
        projectIdOrSlug: projectId,
        monitorIdOrSlug: monitorId,
      },
    }
  );
}

export async function deleteMonitor(api: Client, orgId: string, monitor: Monitor) {
  toast.loading(t('Deleting Monitor...'));

  try {
    await api.requestPromise(getMonitorUrl(orgId, monitor.project.slug, monitor.slug), {
      method: 'DELETE',
    });
    toast.dismiss();
  } catch {
    toast.error(t('Unable to remove monitor.'));
  }
}

export async function deleteMonitorEnvironment(
  api: Client,
  orgId: string,
  monitor: Monitor,
  environment: string
): Promise<boolean> {
  toast.loading(t('Deleting Environment...'));

  try {
    await api.requestPromise(getMonitorUrl(orgId, monitor.project.slug, monitor.slug), {
      method: 'DELETE',
      query: {environment},
    });
    toast.dismiss();
    return true;
  } catch {
    toast.error(t('Unable to remove environment from monitor.'));
  }
  return false;
}

export async function updateMonitor(
  api: Client,
  orgId: string,
  monitor: Monitor,
  data: Partial<Monitor>
): Promise<Monitor | null> {
  toast.loading(t('Saving changes...'));

  try {
    const resp = await api.requestPromise(
      getMonitorUrl(orgId, monitor.project.slug, monitor.slug),
      {method: 'PUT', data}
    );
    toast.dismiss();

    if (data.status !== undefined) {
      const isEnabled = data.status === 'active';
      toast.success(isEnabled ? t('Cron Monitor enabled') : t('Cron Monitor disabled'));
    }

    return resp;
  } catch (err: any) {
    const respError: RequestError = err;
    const updateKeys = Object.keys(data);

    // If we are updating a single value in the monitor we can read the
    // validation error for that key, otherwise fallback to the default error
    const validationError: unknown =
      updateKeys.length === 1
        ? (respError.responseJSON?.[updateKeys[0]!] as any)?.[0]
        : undefined;

    Sentry.captureException(err);
    toast.error(
      typeof validationError === 'string'
        ? validationError
        : t('Unable to update monitor.')
    );
  }

  return null;
}

export async function setEnvironmentIsMuted(
  api: Client,
  orgId: string,
  monitor: Monitor,
  environment: string,
  isMuted: boolean
) {
  toast.loading(t('Saving changes...'));

  try {
    const resp = await api.requestPromise(
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/environments/$environment/',
        {
          path: {
            organizationIdOrSlug: orgId,
            projectIdOrSlug: monitor.project.slug,
            monitorIdOrSlug: monitor.slug,
            environment,
          },
        }
      ),
      {method: 'PUT', data: {isMuted}}
    );
    toast.dismiss();
    return resp;
  } catch (err) {
    Sentry.captureException(err);
    toast.error(
      isMuted ? t('Unable to mute environment.') : t('Unable to unmute environment.')
    );
  }

  return null;
}

export async function deleteMonitorProcessingErrorByType(
  api: Client,
  orgId: string,
  projectId: string,
  monitorSlug: string,
  errortype: ProcessingErrorType
) {
  toast.loading(t('Saving changes...'));

  try {
    await api.requestPromise(
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/processing-errors/',
        {
          path: {
            organizationIdOrSlug: orgId,
            projectIdOrSlug: projectId,
            monitorIdOrSlug: monitorSlug,
          },
        }
      ),
      {
        method: 'DELETE',
        query: {errortype},
      }
    );
    toast.dismiss();
  } catch (err: any) {
    Sentry.captureException(err);
    if (err.status === 403) {
      toast.error(t('You do not have permission to dismiss these processing errors'));
    } else {
      toast.error(t('Unable to dismiss the processing errors'));
    }
  }
}

export async function deleteProjectProcessingErrorByType(
  api: Client,
  orgId: string,
  projectId: string,
  errortype: ProcessingErrorType
) {
  toast.loading(t('Saving changes...'));

  try {
    await api.requestPromise(
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/processing-errors/', {
        path: {organizationIdOrSlug: orgId, projectIdOrSlug: projectId},
      }),
      {
        method: 'DELETE',
        query: {errortype},
      }
    );
    toast.dismiss();
  } catch (err: any) {
    Sentry.captureException(err);
    if (err.status === 403) {
      toast.error(t('You do not have permission to dismiss these processing errors'));
    } else {
      toast.error(t('Unable to dismiss the processing errors'));
    }
  }
}
