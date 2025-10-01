import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

export async function updateUptimeRule(
  api: Client,
  org: Organization,
  project: Project,
  detector: UptimeDetector,
  data: Partial<UptimeRule>
): Promise<UptimeRule | null> {
  addLoadingMessage();

  try {
    const resp = await api.requestPromise(
      `/projects/${org.slug}/${project.slug}/uptime/${detector.id}/`,
      {
        method: 'PUT',
        data,
      }
    );
    clearIndicators();

    if (data.status !== undefined) {
      const isEnabled = data.status === 'active';
      addSuccessMessage(
        isEnabled ? t('Uptime monitor enabled') : t('Uptime monitor disabled')
      );
    }

    return resp;
  } catch (err) {
    const respError = err as RequestError;
    const updateKeys = Object.keys(data);

    // If we are updating a single value in the monitor we can read the
    // validation error for that key, otherwise fallback to the default error
    const validationError =
      updateKeys.length === 1
        ? (respError.responseJSON?.[updateKeys[0]!] as any)?.[0]
        : undefined;

    Sentry.captureException(err);
    addErrorMessage(validationError ?? t('Unable to update uptime monitor.'));
  }

  return null;
}

export async function deleteUptimeRule(
  api: Client,
  org: Organization,
  uptimeRule: UptimeRule
) {
  addLoadingMessage('Deleting uptime alert rule...');

  try {
    await api.requestPromise(
      `/projects/${org.slug}/${uptimeRule.projectSlug}/uptime/${uptimeRule.id}/`,
      {
        method: 'DELETE',
      }
    );
    clearIndicators();
  } catch (_err) {
    addErrorMessage(t('Error deleting rule'));
  }
}
