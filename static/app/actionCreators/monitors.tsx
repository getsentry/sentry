import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {ObjectStatus} from 'sentry/types';
import {logException} from 'sentry/utils/logging';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {Monitor} from 'sentry/views/monitors/types';

export async function deleteMonitor(api: Client, orgId: string, monitor: Monitor) {
  addLoadingMessage(t('Deleting Monitor...'));

  try {
    await api.requestPromise(
      `/projects/${orgId}/${monitor.project.slug}/monitors/${monitor.slug}/`,
      {method: 'DELETE'}
    );
    clearIndicators();
  } catch {
    addErrorMessage(t('Unable to remove monitor.'));
  }
}

export async function deleteMonitorEnvironment(
  api: Client,
  orgId: string,
  monitor: Monitor,
  environment: string
): Promise<boolean> {
  addLoadingMessage(t('Deleting Environment...'));

  try {
    await api.requestPromise(
      `/projects/${orgId}/${monitor.project.slug}/monitors/${monitor.slug}/`,
      {
        method: 'DELETE',
        query: {environment},
      }
    );
    clearIndicators();
    return true;
  } catch {
    addErrorMessage(t('Unable to remove environment from monitor.'));
  }
  return false;
}

export async function updateMonitor(
  api: Client,
  orgId: string,
  monitor: Monitor,
  data: Partial<Monitor>
): Promise<Monitor | null> {
  addLoadingMessage();

  try {
    const resp = await api.requestPromise(
      `/projects/${orgId}/${monitor.project.slug}/monitors/${monitor.slug}/`,
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
      updateKeys.length === 1 ? respError.responseJSON?.[updateKeys[0]]?.[0] : undefined;

    logException(err);
    addErrorMessage(validationError ?? t('Unable to update monitor.'));
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
  addLoadingMessage();

  try {
    const resp = await api.requestPromise(
      `/projects/${orgId}/${monitor.project.id}/monitors/${monitor.slug}/environments/${environment}`,
      {method: 'PUT', data: {isMuted}}
    );
    clearIndicators();
    return resp;
  } catch (err) {
    logException(err);
    addErrorMessage(
      isMuted ? t('Unable to mute environment.') : t('Unable to unmute environment.')
    );
  }

  return null;
}

export interface BulkEditOperation {
  isMuted?: boolean;
  status?: ObjectStatus;
}

interface BulkEditResponse {
  errored: Monitor[];
  updated: Monitor[];
}

export async function bulkEditMonitors(
  api: Client,
  orgId: string,
  slugs: string[],
  operation: BulkEditOperation
): Promise<BulkEditResponse | null> {
  addLoadingMessage();

  try {
    const resp: BulkEditResponse = await api.requestPromise(
      `/organizations/${orgId}/monitors/`,
      {
        method: 'PUT',
        data: {...operation, slugs},
      }
    );
    clearIndicators();
    if (resp.errored?.length > 0) {
      addErrorMessage(t('Unable to apply the changes to all monitors'));
    }
    return resp;
  } catch (err) {
    logException(err);
    addErrorMessage(t('Unable to apply the changes to all monitors'));
  }

  return null;
}
