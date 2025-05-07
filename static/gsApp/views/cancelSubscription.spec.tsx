import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CancelSubscription from 'getsentry/views/cancelSubscription';

describe('CancelSubscription', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 's1',
    isFree: false,
    canCancel: true,
    canSelfServe: true,
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
      body: {},
    });
  });

  it('renders', async function () {
    render(<CancelSubscription />);
    expect(
      await screen.findByRole('heading', {name: 'Cancel Subscription'})
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('radio', {
        name: 'The project/product/company is shutting down.',
      })
    ).toBeInTheDocument();
  });

  it('can not cancel free plans', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: SubscriptionFixture({organization, plan: 'f1', isFree: true}),
    });
    render(<CancelSubscription />);
    expect(
      await screen.findByText(/your plan is not eligible to be cancelled/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('displays followup textarea when option is selected', async function () {
    render(<CancelSubscription />);

    const radio = await screen.findByRole('radio', {
      name: 'The project/product/company is shutting down.',
    });
    expect(radio).toBeInTheDocument();

    expect(screen.queryByRole('textbox', {name: 'followup'})).not.toBeInTheDocument();
    await userEvent.click(radio);
    expect(screen.getByRole('textbox', {name: /Sorry to hear that/})).toBeInTheDocument();
  });

  it('calls cancel API', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'DELETE',
    });
    render(<CancelSubscription />);
    const radio = await screen.findByRole('radio', {name: 'Other'});
    expect(radio).toBeInTheDocument();

    await userEvent.click(radio);
    await userEvent.type(screen.getByRole('textbox'), 'Cancellation reason');
    await userEvent.click(screen.getByRole('button', {name: /Cancel Subscription/}));

    expect(mock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: {
          reason: 'other',
          followup: 'Cancellation reason',
        },
      })
    );
  });
});
