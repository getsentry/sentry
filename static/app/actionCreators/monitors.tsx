import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {logException} from 'sentry/utils/logging';
import {Monitor} from 'sentry/views/monitors/types';

export async function deleteMonitor(api: Client, orgId: string, monitorSlug: string) {
  addLoadingMessage(t('Deleting Monitor...'));

  try {
    await api.requestPromise(`/organizations/${orgId}/monitors/${monitorSlug}/`, {
      method: 'DELETE',
    });
    clearIndicators();
  } catch {
    addErrorMessage(t('Unable to remove monitor.'));
  }
}

export async function updateMonitor(
  api: Client,
  orgId: string,
  monitorSlug: string,
  data: Partial<Monitor>
) {
  addLoadingMessage();

  try {
    const resp = await api.requestPromise(
      `/organizations/${orgId}/monitors/${monitorSlug}/`,
      {method: 'PUT', data}
    );
    clearIndicators();
    return resp;
  } catch (err) {
    logException(err);
    addErrorMessage(t('Unable to update monitor.'));
  }

  return null;
}
