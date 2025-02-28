import {Fragment} from 'react';
import styled from '@emotion/styled';
import BusinessBundleArt from 'getsentry-images/bundles/business-bundle-art-plain.svg';
import CustomBundleArt from 'getsentry-images/bundles/custom-bundle-art-plain.svg';
import TeamBundleArt from 'getsentry-images/bundles/team-bundle-art-plain.svg';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/button';
import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {ANNUAL} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {isDeveloperPlan, isEnterprise, isTeamPlan} from 'getsentry/utils/billing';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {shouldSeeSpendVisibility} from 'getsentry/views/subscriptionPage/utils';

interface SubscriptionCardProps {
  organization: Organization;
  subscription: Subscription;
}

function PlanImage({subscription}: {subscription: Subscription}) {
  if (isDeveloperPlan(subscription.planDetails)) {
    return null;
  }

  let tierImage: any | null = null;
  if (isEnterprise(subscription)) {
    tierImage = BusinessBundleArt;
  } else if (isTeamPlan(subscription.plan)) {
    tierImage = TeamBundleArt;
  } else {
    tierImage = CustomBundleArt;
  }

  return (
    <img
      src={tierImage}
      alt={`${subscription.planDetails.name} logo`}
      width={25}
      style={{marginTop: space(0.25)}}
    />
  );
}

function PriceAndInterval({subscription}: {subscription: Subscription}) {
  if (isDeveloperPlan(subscription.planDetails)) {
    return <PlanSubheader>($0)</PlanSubheader>;
  }

  // Hide price and interval for managed, sponsored, or mm plans
  if (!shouldSeeSpendVisibility(subscription) || !subscription.planDetails?.basePrice) {
    return null;
  }

  return (
    <PlanSubheader>
      ({formatCurrency(subscription.planDetails.basePrice)}/
      {subscription.planDetails.billingInterval === ANNUAL ? t('yr') : t('mo')})
    </PlanSubheader>
  );
}

export function SubscriptionCard({subscription, organization}: SubscriptionCardProps) {
  const renewalDate = subscription.cancelAtPeriodEnd
    ? moment(subscription.contractPeriodEnd)
    : moment(subscription.contractPeriodEnd).add(1, 'days');
  const renewalFormattedDate =
    subscription.billingInterval === 'annual'
      ? renewalDate.format('L')
      : renewalDate
          .toDate()
          .toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'});

  const renewalText = subscription.cancelAtPeriodEnd
    ? t('Cancels on: %s', renewalFormattedDate)
    : t('Renews on: %s', renewalFormattedDate);

  const hasBillingPerms = organization.access?.includes('org:billing');

  return (
    <SubscriptionCardBody data-test-id="subscription-card">
      <PlanHeaderWrapper>
        <PlanImage subscription={subscription} />
        <PlanHeaderCardWrapper>
          <PlanHeader>
            {t('%s Plan', subscription.planDetails?.name)}
            <PriceAndInterval subscription={subscription} />
          </PlanHeader>
          <PaymentDetails>
            {subscription.isPastDue && (
              <div>
                <Tag type="error">{t('Payment Failed')}</Tag>
              </div>
            )}
            {renewalText}
            {hasBillingPerms && subscription.paymentSource ? (
              <Fragment>
                <div>{`CC: **** ${subscription.paymentSource.last4}`}</div>
                <div>
                  Exp: {String(subscription.paymentSource.expMonth).padStart(2, '0')}/
                  {String(subscription.paymentSource.expYear).slice(2)}
                </div>
              </Fragment>
            ) : (
              // Hide 'No Card on File' for VC partner accounts
              subscription.partner?.partnership?.id !== 'VC' && (
                <div>{t('No Card on File')}</div>
              )
            )}
          </PaymentDetails>
          {subscription.isPastDue && (
            <PastDueWrapper>
              <LinkButton
                to={`/settings/${organization.slug}/billing/details/`}
                size="xs"
              >
                {t('Manage Billing Details')}
              </LinkButton>
            </PastDueWrapper>
          )}
        </PlanHeaderCardWrapper>
      </PlanHeaderWrapper>
    </SubscriptionCardBody>
  );
}

const PlanHeader = styled('div')<{isPastDue?: boolean}>`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => (p.isPastDue ? p.theme.red300 : p.theme.textColor)};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  white-space: nowrap;
`;

const PlanHeaderWrapper = styled('div')`
  display: flex;
  gap: ${space(1.5)};
  align-items: flex-start;
`;

const PlanSubheader = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: normal;
`;

const PlanHeaderCardWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const PaymentDetails = styled('div')`
  line-height: 1.5;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: 500;
`;

const SubscriptionCardBody = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(1.5)};
`;

const PastDueWrapper = styled('div')`
  margin-top: ${space(0.25)};
`;
