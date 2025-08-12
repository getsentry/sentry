import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';

import TrialRequestedActions from 'getsentry/actions/trialRequestedActions';
import type {EventType} from 'getsentry/components/addEventsCTA';

export async function sendReplayOnboardRequest({
  api,
  orgSlug,
  onSuccess,
  onError,
  currentPlan,
}: {
  api: Client;
  currentPlan: 'am2-beta' | 'am2-non-beta' | 'am1-beta' | 'am1-non-beta';
  data?: Record<string, any>;
  onError?: () => void;
  onSuccess?: () => void;
  orgSlug?: Organization['slug'];
}) {
  try {
    await api.requestPromise(`/organizations/${orgSlug}/replay-onboard-request/`, {
      method: 'POST',
      data: {
        name: currentPlan,
      },
    });

    addSuccessMessage(
      tct('An owner has been [annoyed] notified!', {annoyed: <s>annoyed</s>})
    );
    onSuccess?.();
  } catch (error) {
    const message = t('Oh shit');
    handleXhrErrorResponse(message, error as RequestError);
    addErrorMessage(message);
    onError?.();
  }
}

export function sendUpgradeRequest({
  organization,
  type,
  ...rest
}: {
  api: Client;
  organization: Organization;
  data?: Record<string, any>;
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
  handleSuccess?: () => void;
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
