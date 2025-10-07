import {Container, Grid} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import BillingInfoCard from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';
import LinksCard from 'getsentry/views/subscriptionPage/headerCards/linksCard';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

function getCards(organization: Organization, subscription: Subscription) {
  const cards: React.ReactNode[] = [];

  cards.push(
    <Container key="subscription-card" background="primary" border="primary" radius="md">
      <SubscriptionCard organization={organization} subscription={subscription} />
    </Container>
  );

  if (subscription.canSelfServe || subscription.onDemandInvoiced) {
    cards.push(
      <BillingInfoCard
        key="billing-info"
        subscription={subscription}
        organization={organization}
      />
    );
  }

  cards.push(<LinksCard key="links" />);

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
