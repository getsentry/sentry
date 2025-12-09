import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, type Subscription} from 'getsentry/types';
import BilledSeats from 'getsentry/views/subscriptionPage/usageOverview/components/billedSeats';

describe('BilledSeats', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({organization, plan: 'am3_business'});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=${DataCategory.SEER_USER}`,
      method: 'GET',
      body: [],
    });
  });

  it('should not render for non-Seer product', () => {
    render(
      <BilledSeats
        selectedProduct={DataCategory.ERRORS}
        subscription={subscription}
        organization={organization}
      />
    );
    expect(screen.queryByText(/Active Contributors/)).not.toBeInTheDocument();
  });

  it('should not render when Seer is disabled', () => {
    subscription.addOns = {
      ...subscription.addOns,
      seer: {
        ...subscription.addOns?.seer!,
        enabled: false,
      },
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <BilledSeats
        selectedProduct={AddOnCategory.SEER}
        subscription={subscription}
        organization={organization}
      />
    );
    expect(screen.queryByText(/Active Contributors/)).not.toBeInTheDocument();
  });

  it('should render when Seer is enabled', () => {
    subscription.addOns = {
      ...subscription.addOns,
      seer: {
        ...subscription.addOns?.seer!,
        enabled: true,
      },
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <BilledSeats
        selectedProduct={AddOnCategory.SEER}
        subscription={subscription}
        organization={organization}
      />
    );
    expect(screen.getByText('Active Contributors (0)')).toBeInTheDocument();
  });

  it('should render the list of active contributors', async () => {
    subscription.addOns = {
      ...subscription.addOns,
      seer: {
        ...subscription.addOns?.seer!,
        enabled: true,
      },
    };
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=${DataCategory.SEER_USER}`,
      method: 'GET',
      body: [
        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'johndoe',
          id: 1,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },
        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'janedoe',
          id: 2,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },
      ],
    });
    render(
      <BilledSeats
        selectedProduct={AddOnCategory.SEER}
        subscription={subscription}
        organization={organization}
      />
    );
    await screen.findByText('Active Contributors (2)');
    expect(screen.getByText('@johndoe')).toBeInTheDocument();
    expect(screen.getByText('@janedoe')).toBeInTheDocument();
  });
});
