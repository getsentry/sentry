import {Grid} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {Organization} from 'sentry/types/organization';
import {useNavContext} from 'sentry/views/nav/context';

import type {Subscription} from 'getsentry/types';
import {
  hasBillingAccess,
  isDeveloperPlan,
  isTrialPlan,
  supportsPayg,
} from 'getsentry/utils/billing';
import BillingInfoCard from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';
import LinksCard from 'getsentry/views/subscriptionPage/headerCards/linksCard';
import NextBillCard from 'getsentry/views/subscriptionPage/headerCards/nextBillCard';
import PaygCard from 'getsentry/views/subscriptionPage/headerCards/paygCard';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

function getCards(organization: Organization, subscription: Subscription) {
  const hasBillingPerms = hasBillingAccess(organization);
  const cards: React.ReactNode[] = [];
  const isTrialOrFreePlan =
    isTrialPlan(subscription.plan) || isDeveloperPlan(subscription.planDetails);

  // the organization can use PAYG
  const canUsePayg = supportsPayg(subscription);

  // the user can update the PAYG budget
  const canUpdatePayg = canUsePayg && hasBillingPerms;

  if (subscription.canSelfServe && !isTrialOrFreePlan && hasBillingPerms) {
    cards.push(
      <NextBillCard
        key="next-bill"
        subscription={subscription}
        organization={organization}
      />
    );
  }

  if (canUsePayg) {
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
  const cards = getCards(organization, subscription);
  const {isCollapsed: navIsCollapsed} = useNavContext();

  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      <Grid
        columns={{
          xs: '1fr',
          sm: `repeat(min(${cards.length}, 2), minmax(0, 1fr))`,
          md: navIsCollapsed ? `repeat(${cards.length}, minmax(0, 1fr))` : undefined,
          lg: `repeat(${cards.length}, minmax(0, 1fr))`,
        }}
        gap="lg"
        data-test-id="subscription-header-cards"
      >
        {cards}
      </Grid>
    </ErrorBoundary>
  );
}

export default HeaderCards;
