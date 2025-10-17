import {Grid} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {
  hasBillingAccess,
  hasNewBillingUI,
  isDeveloperPlan,
  isTrialPlan,
  supportsPayg,
} from 'getsentry/utils/billing';
import BillingInfoCard from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';
import LinksCard from 'getsentry/views/subscriptionPage/headerCards/linksCard';
import NextBillCard from 'getsentry/views/subscriptionPage/headerCards/nextBillCard';
import PaygCard from 'getsentry/views/subscriptionPage/headerCards/paygCard';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

function getCards(organization: Organization, subscription: Subscription) {
  const hasBillingPerms = hasBillingAccess(organization);
  const cards: React.ReactNode[] = [];
  const isTrialOrFreePlan =
    isTrialPlan(subscription.plan) || isDeveloperPlan(subscription.planDetails);
  const canUsePayg = supportsPayg(subscription);

  if (subscription.canSelfServe && !isTrialOrFreePlan && hasBillingPerms) {
    cards.push(
      <NextBillCard
        key="next-bill"
        subscription={subscription}
        organization={organization}
      />
    );
  }

  const canUpdatePayg = canUsePayg && hasBillingPerms;

  if (canUpdatePayg) {
    cards.push(
      <PaygCard key="payg" subscription={subscription} organization={organization} />
    );
  }

  if (
    hasBillingPerms &&
    (canUpdatePayg ||
      (subscription.canSelfServe &&
        isTrialOrFreePlan &&
        !subscription.isEnterpriseTrial)) &&
    !subscription.isSelfServePartner
  ) {
    cards.push(
      <BillingInfoCard
        key="billing-info"
        subscription={subscription}
        organization={organization}
      />
    );
  }

  cards.push(<LinksCard key="links" organization={organization} />);

  return cards;
}

function HeaderCards({organization, subscription}: HeaderCardsProps) {
  const isNewBillingUI = hasNewBillingUI(organization);
  const cards = getCards(organization, subscription);

  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      {isNewBillingUI ? (
        <Grid
          columns={{
            xs: '1fr',
            sm: `repeat(min(${cards.length}, 2), minmax(0, 1fr))`,
            md: `repeat(${cards.length}, minmax(0, 1fr))`,
          }}
          gap="xl"
        >
          {cards}
        </Grid>
      ) : (
        <Grid
          background="primary"
          border="primary"
          radius="md"
          columns={{lg: 'auto minmax(0, 600px)'}}
          gap={{lg: 'xl'}}
        >
          <SubscriptionCard organization={organization} subscription={subscription} />
          <UsageCard organization={organization} subscription={subscription} />
        </Grid>
      )}
    </ErrorBoundary>
  );
}

export default HeaderCards;
