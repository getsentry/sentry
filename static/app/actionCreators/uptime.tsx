import * as Sentry from '@sentry/react';

import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import type {UptimeRule} from 'sentry/views/detectors/components/uptime/types';

export async function updateUptimeRule(
  api: Client,
  org: Organization,
  project: Project,
  detector: UptimeDetector,
  data: Partial<UptimeRule>
): Promise<UptimeRule | null> {
  toast.loading(t('Saving changes...'));

  try {
    const resp = await api.requestPromise(
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/',
        {
          path: {
            organizationIdOrSlug: org.slug,
            projectIdOrSlug: project.slug,
            uptimeDetectorId: detector.id,
          },
        }
      ),
      {
        method: 'PUT',
        data,
      }
    );
    toast.dismiss();

    if (data.status !== undefined) {
      const isEnabled = data.status === 'active';
      toast.success(
        isEnabled ? t('Uptime monitor enabled') : t('Uptime monitor disabled')
      );
    }

    return resp;
  } catch (err) {
    const respError = err as RequestError;
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
        : t('Unable to update uptime monitor.')
    );
  }

  return null;
}

export async function deleteUptimeRule(
  api: Client,
  org: Organization,
  uptimeRule: UptimeRule
) {
  toast.loading('Deleting uptime alert rule...');

  try {
    await api.requestPromise(
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/',
        {
          path: {
            organizationIdOrSlug: org.slug,
            projectIdOrSlug: uptimeRule.projectSlug,
            uptimeDetectorId: uptimeRule.id,
          },
        }
      ),
      {
        method: 'DELETE',
      }
    );
    toast.dismiss();
  } catch (_err) {
    toast.error(t('Error deleting rule'));
  }
}
