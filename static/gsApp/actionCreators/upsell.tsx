import * as Sentry from '@sentry/react';

import {toast} from '@sentry/scraps/toast';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {EventType} from 'getsentry/components/addEventsCTA';
import {TrialRequestedStore} from 'getsentry/stores/trialRequestedStore';

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
      TrialRequestedStore.markRequested();
      handleSuccess?.();
    },
    ...rest,
  });
}

export function sendSeerTopUpRequest({
  organization,
  ...rest
}: {
  api: Client;
  organization: Organization;
  handleSuccess?: () => void;
}) {
  const endpoint = `/organizations/${organization.slug}/seer-top-up-request/`;
  return sendBasicRequest({
    endpoint,
    data: {},
    successMessage: t('Admins emailed.'),
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
  successMessage = t('Request Sent'),
}: {
  api: Client;
  data: Record<string, any>;
  endpoint: string;
  handleSuccess?: () => void;
  successMessage?: string;
}) {
  try {
    toast.loading(t('Requesting\u2026'));
    await api.requestPromise(endpoint, {
      method: 'POST',
      data,
    });
    toast.success(successMessage);
    handleSuccess?.();
  } catch (err) {
    toast.error(t('Unable to send request'));
    Sentry.captureException(err);
  }
}
