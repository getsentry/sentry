import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import Details from 'getsentry/components/upsellModal/details';
import {PlanTier} from 'getsentry/types';

describe('Upsell Modal Details', function () {
  const organization = OrganizationFixture({access: ['org:billing']});
  const subscription = SubscriptionFixture({organization, plan: 'am1_f'});
  const billingConfig = BillingConfigFixture(PlanTier.AM2);

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am2'},
      body: billingConfig,
    });
  });

  it('renders', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      canTrial: true,
      isTrial: false,
      isFree: true,
    });

    render(
      <Details
        source="test"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );

    // framer-motion causes 2 of these to exist
    expect(await screen.findByTestId('default-messaging')).toBeInTheDocument();
    expect(screen.queryByTestId('highlighted-feature')).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Upgrade now'})).toBeInTheDocument();
  });

  it('renders team features with subscription trial plan', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_t',
      canTrial: false,
      isTrial: true,
      isFree: false,
    });

    render(
      <Details
        source="event-volume"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );

    expect(await screen.findByText('Features Include')).toBeInTheDocument();

    // Check that the source feature is highlighted.
    expect(screen.getByTestId('extended-data-retention')).not.toHaveAttribute(
      'aria-selected'
    );
    expect(screen.getByTestId('event-volume')).toHaveAttribute('aria-selected');
  });

  it('renders team features with free plan', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      canTrial: true,
      isTrial: false,
      isFree: true,
    });

    render(
      <Details
        source="event-volume"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );

    expect(await screen.findByText('Features Include')).toBeInTheDocument();

    // Check that the source feature is highlighted.
    expect(screen.getByTestId('extended-data-retention')).not.toHaveAttribute(
      'aria-selected'
    );
    expect(screen.getByTestId('event-volume')).toHaveAttribute('aria-selected');
  });

  it('renders business features with paid plan', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      canTrial: true,
      isTrial: false,
      isFree: false,
    });

    render(
      <Details
        source="sso"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    expect(await screen.findByText('Business Features Include')).toBeInTheDocument();

    // Check that the source feature is highlighted.
    expect(screen.queryByTestId('extended-data-retention')).not.toBeInTheDocument();
    expect(screen.getByTestId('sso')).toHaveAttribute('aria-selected');
  });

  it('shows performance features when on a old mm2 plan', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_100k',
      canTrial: true,
      isTrial: false,
      isFree: false,
    });

    render(
      <Details
        source="tracing"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    expect(await screen.findByText('Features Include')).toBeInTheDocument();

    // Check that the source feature is highlighted.
    expect(screen.queryByTestId('global-views')).not.toBeInTheDocument();
    expect(screen.getByTestId('tracing')).toHaveAttribute('aria-selected');
  });

  it('cycles the list on a timer when no section is clicked', async function () {
    jest.useFakeTimers();
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_100k',
      canTrial: true,
      isTrial: false,
      isFree: false,
    });

    render(
      <Details
        source="test"
        subscription={sub}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );

    // First timeout is waiting for it to cycle to a feature
    act(() => jest.advanceTimersByTime(10000));

    // First feature in the displayed list.
    const tracing = screen.getByTestId('tracing');
    expect(tracing).toHaveAttribute('aria-selected');

    // Next timeout is for it to cycle to the _next_ feature
    act(() => jest.advanceTimersByTime(8000));

    // Avoid act warning after state change
    jest.useRealTimers();
    await act(tick);

    // Tracing should now not be highlighted.
    expect(tracing).not.toHaveAttribute('aria-selected');
  });
});
