import {useState} from 'react';

import type {Client} from 'sentry/api';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import type {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import {sendAddEventsRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import StartTrialButton from 'getsentry/components/startTrialButton';
import type {Subscription} from 'getsentry/types';
import {
  displayBudgetName,
  getBestActionToIncreaseEventLimits,
} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

/**
 * Add event types before they are explicitly set with `isBilledCategory: true`
 * in DATA_CATEGORY_INFO (ie. before launch) for use in quota CTAs and notifications.
 */
export const TEMPORARY_EVENT_TYPES = [
  DataCategoryExact.SEER_AUTOFIX,
  DataCategoryExact.SEER_SCANNER,
];

/**
 * Event types for quota CTAs and notifications.
 * When a new billed category is added, all records keying on EventType
 * will error to alert the author that they need to be updated.
 *
 * TODO(data categories): move this to dataCategory.tsx
 */
export type EventType =
  | {
      [K in keyof typeof DATA_CATEGORY_INFO]: (typeof DATA_CATEGORY_INFO)[K]['isBilledCategory'] extends true
        ? (typeof DATA_CATEGORY_INFO)[K]['name']
        : never;
    }[keyof typeof DATA_CATEGORY_INFO]
  | (typeof TEMPORARY_EVENT_TYPES)[number];

type Props = {
  api: Client;
  organization: Organization;
  referrer: string;
  source: string;
  subscription: Subscription;
  buttonProps?: Partial<ButtonProps>;
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
  const commonProps: Partial<ButtonProps> & {
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

  switch (action) {
    case 'add_events':
      return (
        <Button to={subscriptionUrl} onClick={() => manageOnDemand()} {...commonProps}>
          {tct('[action] [budgetTerm]', {
            action: subscription.onDemandBudgets?.enabled ? 'Increase' : 'Setup',
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
          })}
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
