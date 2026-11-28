import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';

import {SubscriptionLoadingFallback} from 'getsentry/components/subscriptionLoadingFallback';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

function PlanName({organization}: {organization?: Organization}) {
  const subscription = useSubscription({organization});

  if (!subscription) {
    return <SubscriptionLoadingFallback organization={organization} />;
  }

  return <div>Plan: {subscription.planDetails.name}</div>;
}

describe('SubscriptionLoadingFallback', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const customersUrl = `/customers/${organization.slug}/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.init();
  });

  it('shows a loading indicator while the subscription loads', async () => {
    MockApiClient.addMockResponse({url: customersUrl, body: subscription});

    render(<PlanName />, {organization});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      await screen.findByText(`Plan: ${subscription.planDetails.name}`)
    ).toBeInTheDocument();
  });

  it('requests the subscription once when rendered alongside useSubscription', async () => {
    const request = MockApiClient.addMockResponse({
      url: customersUrl,
      body: subscription,
    });

    render(<PlanName />, {organization});

    expect(
      await screen.findByText(`Plan: ${subscription.planDetails.name}`)
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('shows an error with Retry when the subscription fails to load', async () => {
    MockApiClient.addMockResponse({url: customersUrl, statusCode: 500, body: {}});

    render(<PlanName />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    MockApiClient.addMockResponse({url: customersUrl, body: subscription});
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(
      await screen.findByText(`Plan: ${subscription.planDetails.name}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByText('There was an error loading data.')
    ).not.toBeInTheDocument();
  });

  it('shows the error again when a retry also fails', async () => {
    const request = MockApiClient.addMockResponse({
      url: customersUrl,
      statusCode: 500,
      body: {},
    });

    render(<PlanName />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('loads the subscription of the organization it is given', async () => {
    const otherOrganization = OrganizationFixture({slug: 'other-org'});
    const otherSubscription = SubscriptionFixture({
      organization: otherOrganization,
      plan: 'am2_business',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${otherOrganization.slug}/`,
      body: otherSubscription,
    });

    render(<PlanName organization={otherOrganization} />, {organization});

    expect(
      await screen.findByText(`Plan: ${otherSubscription.planDetails.name}`)
    ).toBeInTheDocument();
  });
});
