import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {ObjectStatus} from 'sentry/types/core';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {Monitor, ProcessingErrorType} from 'sentry/views/monitors/types';

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
      updateKeys.length === 1
        ? (respError.responseJSON?.[updateKeys[0]!] as any)?.[0]
        : undefined;

    Sentry.captureException(err);
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
      `/projects/${orgId}/${monitor.project.slug}/monitors/${monitor.slug}/environments/${environment}`,
      {method: 'PUT', data: {isMuted}}
    );
    clearIndicators();
    return resp;
  } catch (err) {
    Sentry.captureException(err);
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
  ids: string[],
  operation: BulkEditOperation
): Promise<BulkEditResponse | null> {
  addLoadingMessage();

  try {
    const resp: BulkEditResponse = await api.requestPromise(
      `/organizations/${orgId}/monitors/`,
      {
        method: 'PUT',
        data: {...operation, ids},
      }
    );
    clearIndicators();
    if (resp.errored?.length > 0) {
      addErrorMessage(t('Unable to apply the changes to all monitors'));
    }
    return resp;
  } catch (err) {
    Sentry.captureException(err);
    addErrorMessage(t('Unable to apply the changes to all monitors'));
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
  addLoadingMessage();

  try {
    await api.requestPromise(
      `/projects/${orgId}/${projectId}/monitors/${monitorSlug}/processing-errors/`,
      {
        method: 'DELETE',
        query: {errortype},
      }
    );
    clearIndicators();
  } catch (err) {
    Sentry.captureException(err);
    if (err.status === 403) {
      addErrorMessage(t('You do not have permission to dismiss these processing errors'));
    } else {
      addErrorMessage(t('Unable to dismiss the processing errors'));
    }
  }
}

export async function deleteProjectProcessingErrorByType(
  api: Client,
  orgId: string,
  projectId: string,
  errortype: ProcessingErrorType
) {
  addLoadingMessage();

  try {
    await api.requestPromise(`/projects/${orgId}/${projectId}/processing-errors/`, {
      method: 'DELETE',
      query: {errortype},
    });
    clearIndicators();
  } catch (err) {
    Sentry.captureException(err);
    if (err.status === 403) {
      addErrorMessage(t('You do not have permission to dismiss these processing errors'));
    } else {
      addErrorMessage(t('Unable to dismiss the processing errors'));
    }
  }
}
