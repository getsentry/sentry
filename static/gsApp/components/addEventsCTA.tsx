import {useState} from 'react';

import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import {sendAddEventsRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import StartTrialButton from 'getsentry/components/startTrialButton';
import {PlanTier, type Subscription} from 'getsentry/types';
import {getBestActionToIncreaseEventLimits} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

export type EventType =
  | 'error'
  | 'transaction'
  | 'attachment'
  | 'replay'
  | 'monitorSeat'
  | 'span'
  | 'profileDuration'
  | 'uptime';

type Props = {
  api: Client;
  organization: Organization;
  referrer: string;
  source: string;
  subscription: Subscription;
  buttonProps?: Partial<React.ComponentProps<typeof Button>>;
  eventTypes?: EventType[];
  handleRequestSent?: () => void;
  notificationType?: 'overage_warning' | 'overage_critical';
};

/**
 *
 * This renders a CTA button which is used to add events to account by various means.
 * If the org is on a paid plan, we ask the user to increase event limits or make a request to do so if lacking permissions.
 * If on a free plan and trial avaiable, we render a CTA to start/request trial
 * If free plan but no trial, render CTA to upgrade or request an upgrade
 */
function AddEventsCTA(props: Props) {
  const {
    subscription,
    organization,
    api,
    eventTypes,
    notificationType,
    referrer,
    handleRequestSent,
    source,
    buttonProps,
  } = props;

  const [busy, setBusy] = useState(false);

  const wrapRequest = async (promise: Promise<void>) => {
    setBusy(true);
    await promise;
    setBusy(false);
  };

  const action = getBestActionToIncreaseEventLimits(organization, subscription);
  const commonProps: Partial<React.ComponentProps<typeof Button>> & {
    'data-test-id'?: string;
  } = {
    size: 'xs',
    priority: 'primary',
    busy,
    disabled: busy,
    'data-test-id': `btn-${action}`,
    ...buttonProps,
  };

  const requestArgs = {
    api,
    organization,
  };

  const handleAnalytics = () => {
    trackGetsentryAnalytics('add_event_cta.clicked_cta', {
      organization,
      subscription,
      event_types: eventTypes?.sort().join(','),
      source,
      action,
    });
  };

  const manageOnDemand = () => {
    handleAnalytics();
    setTimeout(() => {
      openOnDemandBudgetEditModal(props);
    }, 0);
  };

  const checkoutUrl = `/settings/${organization.slug}/billing/checkout/?referrer=${referrer}`;
  const subscriptionUrl = `/settings/${organization.slug}/billing/overview/`;

  // Make an exception for when only crons has an overage to change the language to be more fitting
  const strictlyCronsOverage =
    eventTypes?.length === 1 && eventTypes[0] === 'monitorSeat';

  switch (action) {
    case 'add_events':
      return (
        <Button to={subscriptionUrl} onClick={() => manageOnDemand()} {...commonProps}>
          {subscription.planTier === PlanTier.AM3
            ? subscription?.onDemandBudgets?.enabled
              ? t('Increase Pay-as-you-go')
              : t('Setup Pay-as-you-go')
            : strictlyCronsOverage
              ? t('Update Plan')
              : t('Increase Reserved Limits')}
        </Button>
      );
    case 'request_add_events':
      return (
        <Button
          onClick={async () => {
            handleAnalytics();
            await wrapRequest(
              sendAddEventsRequest({
                eventTypes,
                notificationType,
                ...requestArgs,
              })
            );
            handleRequestSent?.();
          }}
          {...commonProps}
        >
          {t('Request Additional Quota')}
        </Button>
      );
    case 'start_trial':
      return (
        <StartTrialButton
          organization={organization}
          source={source}
          onTrialStarted={() => {
            handleRequestSent?.();
            setBusy(false);
          }}
          onTrialFailed={() => setBusy(false)}
          handleClick={() => {
            setBusy(true);
            handleAnalytics();
          }}
          {...commonProps}
        >
          {t('Start Trial')}
        </StartTrialButton>
      );
    case 'request_upgrade':
      return (
        <Button
          onClick={async () => {
            handleAnalytics();
            await wrapRequest(sendUpgradeRequest(requestArgs));
            handleRequestSent?.();
          }}
          {...commonProps}
        >
          {t('Request Upgrade')}
        </Button>
      );
    case 'send_to_checkout':
    default:
      return (
        <Button to={checkoutUrl} onClick={() => handleAnalytics()} {...commonProps}>
          {t('Upgrade Plan')}
        </Button>
      );
  }
}

export default withApi(AddEventsCTA);
