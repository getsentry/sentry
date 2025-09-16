import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';
import SeerAutomationAlert from 'getsentry/views/subscriptionPage/seerAutomationAlert';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

export function HeaderCards({organization, subscription}: HeaderCardsProps) {
  return (
    <ErrorBoundary mini>
      <SeerAutomationAlert organization={organization} />
      <HeaderCardWrapper hasNewCheckout={hasNewBillingUI(organization)}>
        <SubscriptionCard organization={organization} subscription={subscription} />
        <UsageCard organization={organization} subscription={subscription} />
      </HeaderCardWrapper>
    </ErrorBoundary>
  );
}

// TODO(checkout v3): update this with the real layout
const HeaderCardWrapper = styled(Panel)<{hasNewCheckout: boolean}>`
  display: grid;
  margin-bottom: ${space(2)};

  ${p =>
    !p.hasNewCheckout &&
    css`
      @media (min-width: ${p.theme.breakpoints.lg}) {
        grid-template-columns: auto minmax(0, 600px);
        gap: ${space(2)};
      }
    `}
`;
