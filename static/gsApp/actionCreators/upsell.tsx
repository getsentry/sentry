import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {TrialRequestedActions} from 'getsentry/actions/trialRequestedActions';
import type {EventType} from 'getsentry/components/addEventsCTA';

export function sendUpgradeRequest({
  organization,
  type,
  ...rest
}: {
  api: Client;
  organization: Organization;
  handleSuccess?: () => void;
  type?: string;
}) {
  const endpoint = `/organizations/${organization.slug}/plan-upgrade-request/`;
  const data = {type};
  return sendBasicRequest({
    endpoint,
    data,
    ...rest,
  });
}

export function sendTrialRequest({
  organization,
  handleSuccess,
  ...rest
}: {
  api: Client;
  organization: Organization;
  handleSuccess?: () => void;
}) {
  const endpoint = `/organizations/${organization.slug}/trial-request/`;
  return sendBasicRequest({
    endpoint,
    data: {},
    handleSuccess: () => {
      // show confirmation through trialStartedSidebarItem
      TrialRequestedActions.requested();
      handleSuccess?.();
    },
    ...rest,
  });
}

export function sendAddEventsRequest({
  organization,
  eventTypes,
  notificationType,
  ...rest
}: {
  api: Client;
  organization: Organization;
  eventTypes?: EventType[];
  notificationType?: string;
}) {
  const endpoint = `/organizations/${organization.slug}/event-limit-increase-request/`;
  const data = {types: eventTypes, notificationType};
  return sendBasicRequest({
    endpoint,
    data,
    ...rest,
  });
}

async function sendBasicRequest({
  api,
  endpoint,
  data,
  handleSuccess,
}: {
  api: Client;
  data: Record<string, any>;
  endpoint: string;
  handleSuccess?: () => void;
}) {
  try {
    addLoadingMessage(t('Requesting\u2026'));
    await api.requestPromise(endpoint, {
      method: 'POST',
      data,
    });
    addSuccessMessage(t('Request Sent'));
    handleSuccess?.();
  } catch (err) {
    addErrorMessage(t('Unable to send request'));
    Sentry.captureException(err);
  }
}
