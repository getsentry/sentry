import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

export async function updateUptimeRule(
  api: Client,
  orgId: string,
  uptimeRule: UptimeRule,
  data: Partial<UptimeRule>
): Promise<UptimeRule | null> {
  addLoadingMessage();

  try {
    const resp = await api.requestPromise(
      `/projects/${orgId}/${uptimeRule.projectSlug}/uptime/${uptimeRule.id}/`,
      {method: 'PUT', data}
    );
    clearIndicators();
    return resp;
  } catch (err) {
    const respError: RequestError = err;
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
