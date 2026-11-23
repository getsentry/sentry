import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {withSubscription} from 'getsentry/components/withSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

function PlanName({subscription}: {subscription: Subscription}) {
  return <div>Plan: {subscription.planDetails.name}</div>;
}

describe('withSubscription', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const customersUrl = `/customers/${organization.slug}/`;

  beforeEach(() => {
    SubscriptionStore.init();
  });

  it('renders the wrapped component once the subscription loads', async () => {
    MockApiClient.addMockResponse({url: customersUrl, body: subscription});
    const WrappedPlanName = withSubscription(PlanName);

    render(<WrappedPlanName />, {organization});

    expect(
      await screen.findByText(`Plan: ${subscription.planDetails.name}`)
    ).toBeInTheDocument();
  });

  it('shows an error with Retry when the subscription fails to load', async () => {
    MockApiClient.addMockResponse({url: customersUrl, statusCode: 500, body: {}});
    const WrappedPlanName = withSubscription(PlanName);

    render(<WrappedPlanName />, {organization});

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

  it('renders nothing when the subscription fails to load with noLoader', async () => {
    MockApiClient.addMockResponse({url: customersUrl, statusCode: 500, body: {}});
    const WrappedPlanName = withSubscription(PlanName, {noLoader: true});

    const {container} = render(<WrappedPlanName />, {organization});

    await waitFor(() =>
      expect(SubscriptionStore.errors[organization.slug]).toBeDefined()
    );
    expect(container).toBeEmptyDOMElement();
  });
});
