import {Fragment, useId} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {IconRefresh} from '@sentry/icons/refresh';
import {IconSettings} from '@sentry/icons/settings';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  ActionKindApplyProps,
  ActionKindUI,
} from 'sentry/views/investigations/actionRequests/actionKinds';
import {ApplyButton} from 'sentry/views/investigations/actionRequests/applyButton';
import type {ActionRequestFollowUp} from 'sentry/views/investigations/api';
import type {
  InvestigationActionRequest,
  InvestigationConnectTelemetryAction,
} from 'sentry/views/investigations/types';

export const connectTelemetryUI: ActionKindUI<InvestigationConnectTelemetryAction> = {
  Apply: ConnectTelemetryApply,
  checksBeforeApply: true,
  getActivityTitle: ({action, actorName}) => {
    const name = getProviderName(action.provider);
    return actorName ? t('%s connected %s', actorName, name) : t('%s connected', name);
  },
  getActivityNote: ({action, actionRequest}) =>
    actionRequest.followUp?.status === 'failed'
      ? getRerunFailedNote(actionRequest.followUp, getProviderName(action.provider))
      : null,
  getAppliedSummary: ({action, actionRequest}) => {
    const name = getProviderName(action.provider);
    const note = getRerunNote(actionRequest, name);
    return (
      <Fragment>
        <Text bold>{t('%s connected.', name)}</Text>
        {note ? ` ${note}` : null}
      </Fragment>
    );
  },
  getCannotApplyMessage: reason =>
    reason === 'permission_denied'
      ? t('You need permission to install integrations.')
      : null,
  refreshOnFocus: actionRequest =>
    actionRequest.state === 'suggested' && actionRequest.canApply,
};

function ConnectTelemetryApply({
  action,
  actionRequest,
  applying,
  check,
  finishing,
  message,
  onApply,
  onRecheck,
  rechecking,
}: ActionKindApplyProps<InvestigationConnectTelemetryAction>) {
  const organization = useOrganization();
  const messageId = useId();
  const to = normalizeUrl(
    `/settings/${organization.slug}/integrations/${action.provider}/`
  );
  const name = getProviderName(action.provider);

  switch (actionRequest.state) {
    case 'suggested':
      if (actionRequest.canApply && check.status === 'pending') {
        return (
          <ApplyButton
            canApply
            applying={false}
            check={check}
            disabled={false}
            message={null}
            onApply={onApply}
            onRecheck={onRecheck}
            rechecking={false}
            icon={<IconRefresh />}
            label={t('Checking the %s connection…', name)}
            busyLabel={t('Checking the %s connection…', name)}
          />
        );
      }
      return actionRequest.canApply && check.status === 'passed' ? (
        <ApplyButton
          canApply
          applying={applying}
          check={check}
          disabled={finishing}
          message={message}
          onApply={onApply}
          onRecheck={onRecheck}
          rechecking={rechecking}
          icon={<IconRefresh />}
          label={t('Re-run with %s', name)}
          busyLabel={t('Re-running with %s…', name)}
        />
      ) : (
        <Flex align="center" gap="md" wrap="wrap">
          <LinkButton
            variant="primary"
            icon={<IconSettings />}
            to={to}
            openInNewTab
            disabled={!actionRequest.canApply}
            aria-describedby={actionRequest.canApply ? undefined : messageId}
          >
            {t('Connect %s', name)}
            <NewTabNote />
          </LinkButton>
          {actionRequest.canApply ? null : (
            <Text id={messageId} size="sm" variant="muted">
              {message}
            </Text>
          )}
        </Flex>
      );
    case 'applied':
      return (
        <LinkButton icon={<IconSettings />} to={to} openInNewTab>
          {t('View integration')}
          <NewTabNote />
        </LinkButton>
      );
    default:
      return null;
  }
}

function getRerunNote(actionRequest: InvestigationActionRequest, providerName: string) {
  const {followUp} = actionRequest;
  if (!followUp) {
    return null;
  }
  if (followUp.status === 'failed') {
    return getRerunFailedNote(followUp, providerName);
  }
  switch (followUp.rerun) {
    case 'started':
      return t('Seer started re-running the investigation with it.');
    case 'held':
      return t(
        'Seer will re-run the investigation with it once the current run finishes.'
      );
    default:
      return t('Seer will re-run the investigation with it.');
  }
}

function getRerunFailedNote(followUp: ActionRequestFollowUp, providerName: string) {
  switch (followUp.reason) {
    case 'run_cancelled':
      return t("Seer didn't re-run the investigation because it was cancelled.");
    case 'run_failed':
      return t("Seer didn't re-run the investigation because the run failed.");
    case 'provider_not_connected':
      return t(
        "Seer couldn't find the %s connection, so it didn't re-run the investigation.",
        providerName
      );
    case 'provider_already_used':
      return t(
        "Seer already used %s in this investigation, so it didn't re-run it.",
        providerName
      );
    default:
      return t("Seer couldn't re-run the investigation with it.");
  }
}

function getProviderName(provider: InvestigationConnectTelemetryAction['provider']) {
  switch (provider) {
    case 'datadog':
      return t('Datadog');
    case 'gcp':
      return t('Google Cloud');
    default:
      return provider;
  }
}

function NewTabNote() {
  return <VisuallyHidden> {t('(opens in a new tab)')}</VisuallyHidden>;
}
