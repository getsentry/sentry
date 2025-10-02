import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import {IconGrid, IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {Subscription} from 'getsentry/types';
import {getPlanIcon, getProductIcon, hasNewBillingUI} from 'getsentry/utils/billing';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

export function HeaderCards({organization, subscription}: HeaderCardsProps) {
  const isNewBillingUI = hasNewBillingUI(organization);

  const cards = [
    <PlanCard key="plan" subscription={subscription} organization={organization} />,
  ].filter(card => card !== null);

  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      {isNewBillingUI ? (
        <Grid
          columns={{
            xs: '1fr',
            sm: `repeat(${Math.min(cards.length, 2)}, 1fr)`,
            md: `repeat(${cards.length}, 1fr)`,
          }}
        >
          {cards}
        </Grid>
      ) : (
        <HeaderCardWrapper>
          <SubscriptionCard organization={organization} subscription={subscription} />
          <UsageCard organization={organization} subscription={subscription} />
        </HeaderCardWrapper>
      )}
    </ErrorBoundary>
  );
}

function PlanCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const button = subscription.isFree
    ? {
        ariaLabel: t('Upgrade plan'),
        label: t('Upgrade plan'),
        linkTo: `/settings/${organization.slug}/billing/checkout/?referrer=upgrade_plan`,
        icon: <IconUpgrade />,
        priority: 'primary' as const,
      }
    : {
        ariaLabel: t('Edit plan'),
        label: t('Edit plan'),
        linkTo: `/settings/${organization.slug}/billing/checkout/?referrer=edit_plan`,
        icon: <IconUpgrade />,
        priority: 'default' as const,
      };
  return (
    <SubscriptionHeaderCard
      title={t('Current plan')}
      icon={<IconGrid />}
      subtitle={tct('[startDate] - [endDate]', {
        startDate: moment(subscription.contractPeriodStart).format('MMM D, YYYY'),
        endDate: moment(subscription.contractPeriodEnd).format('MMM D, YYYY'),
      })}
      sections={[
        <Flex key="plan" gap="sm" align="center">
          {getPlanIcon(subscription.planDetails)}
          <Text bold>{t('%s Plan', subscription.planDetails.name)}</Text>
        </Flex>,
        ...Object.values(subscription.addOns ?? {})
          .filter(addOn => addOn.enabled)
          .map(addOn => (
            <Flex key={addOn.apiName} gap="sm" align="center">
              {getProductIcon(addOn.apiName)}
              <Text bold>
                {toTitleCase(addOn.productName, {allowInnerUpperCase: true})}
              </Text>
            </Flex>
          )),
      ]}
      button={button}
    />
  );
}

// TODO(checkout v3): update this with the real layout
const HeaderCardWrapper = styled(Panel)`
  display: grid;
  margin-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: auto minmax(0, 600px);
    gap: ${p => p.theme.space.xl};
  }
`;
