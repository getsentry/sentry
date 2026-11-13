import {Grid} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {Organization} from 'sentry/types/organization';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

import type {Subscription} from 'getsentry/types';
import {
  hasBillingAccess,
  shouldShowBillingInformation,
  supportsPayg,
} from 'getsentry/utils/billing';
import {BillingInfoCard} from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';
import {LinksCard} from 'getsentry/views/subscriptionPage/headerCards/linksCard';
import {NextBillCard} from 'getsentry/views/subscriptionPage/headerCards/nextBillCard';
import {PaygCard} from 'getsentry/views/subscriptionPage/headerCards/paygCard';
import {SeerWalletCard} from 'getsentry/views/subscriptionPage/headerCards/seerWalletCard';
import {SeerAutomationAlert} from 'getsentry/views/subscriptionPage/seerAutomationAlert';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

const SEER_WALLET_CARD_KEY = 'seer-wallet';

function getCards(organization: Organization, subscription: Subscription) {
  const hasBillingPerms = hasBillingAccess(organization);
  const cards: React.ReactElement[] = [];

  const isPaidPlan = subscription.planDetails.totalPrice > 0;

  // the organization can use PAYG
  const canUsePayg = supportsPayg(subscription);

  if (subscription.canSelfServe && isPaidPlan && hasBillingPerms) {
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

  if (hasBillingPerms && organization.features.includes('token-billed-seer-enabled')) {
    cards.push(<SeerWalletCard key={SEER_WALLET_CARD_KEY} organization={organization} />);
  }

  if (shouldShowBillingInformation(subscription, organization)) {
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

export function HeaderCards({organization, subscription}: HeaderCardsProps) {
  const cards = getCards(organization, subscription);
  const {view} = useSecondaryNavigation();
  const navIsCollapsed = view !== 'expanded';
  // The Seer card keeps the design's fixed width when the cards share a row, so
  // its auto-reload footer doesn't wrap; the other cards split what's left.
  const singleRowColumns = cards
    .map(card => (card.key === SEER_WALLET_CARD_KEY ? '320px' : 'minmax(0, 1fr)'))
    .join(' ');

  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      <Grid
        columns={{
          zero: '1fr',
          xl: `repeat(min(${cards.length}, 2), minmax(0, 1fr))`,
          '3xl': navIsCollapsed ? singleRowColumns : undefined,
          '4xl': singleRowColumns,
        }}
        gap="lg"
        data-test-id="subscription-header-cards"
      >
        {cards}
      </Grid>
    </ErrorBoundary>
  );
}
