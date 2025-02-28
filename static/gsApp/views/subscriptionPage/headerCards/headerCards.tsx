import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';

import {SubscriptionCard} from './subscriptionCard';
import {UsageCard} from './usageCard';

interface HeaderCardsProps {
  organization: Organization;
  subscription: Subscription;
}

export function HeaderCards({organization, subscription}: HeaderCardsProps) {
  return (
    <ErrorBoundary mini>
      <HeaderCardWrapper>
        <SubscriptionCard organization={organization} subscription={subscription} />
        <UsageCard organization={organization} subscription={subscription} />
      </HeaderCardWrapper>
    </ErrorBoundary>
  );
}

const HeaderCardWrapper = styled(Panel)`
  display: grid;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: auto minmax(0, 600px);
    gap: ${space(2)};
  }
`;
