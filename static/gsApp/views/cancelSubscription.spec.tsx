import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CancelSubscription from 'getsentry/views/cancelSubscription';

describe('CancelSubscription', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 's1',
    isFree: false,
    canCancel: true,
    canSelfServe: true,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
  });

  it('renders', async () => {
    render(<CancelSubscription />);
    expect(
      await screen.findByText('The project/product/company is shutting down.')
    ).toBeInTheDocument();
  });

  it('requires a cancellation reason', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'DELETE',
    });
    render(<CancelSubscription />);

    const reason = await screen.findByRole('radiogroup', {name: /Reason/});
    expect(reason).toBeInTheDocument();
    const submitButton = screen.getByRole('button', {name: 'Cancel Subscription'});
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Consolidating Sentry accounts.'));
    expect(submitButton).toBeEnabled();
  });

  it('requires follow-up details before cancelling', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'DELETE',
    });
    render(<CancelSubscription />);

    await userEvent.click(await screen.findByText('Consolidating Sentry accounts.'));
    await userEvent.click(screen.getByRole('button', {name: 'Cancel Subscription'}));

    expect(mock).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('can not cancel free plans', async () => {
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

  it('displays followup textarea when option is selected', async () => {
    render(<CancelSubscription />);

    const radio = await screen.findByText(
      'The project/product/company is shutting down.'
    );
    expect(radio).toBeInTheDocument();

    expect(screen.queryByRole('textbox', {name: 'followup'})).not.toBeInTheDocument();
    await userEvent.click(radio);
    expect(screen.getByRole('textbox', {name: /Sorry to hear that/})).toBeInTheDocument();
  });

  it('calls cancel API', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'DELETE',
    });
    render(<CancelSubscription />);
    const radio = await screen.findByText('We are switching to a different solution.');
    expect(radio).toBeInTheDocument();

    await userEvent.click(radio);
    await userEvent.type(screen.getByRole('textbox'), 'Cancellation reason');
    await userEvent.click(screen.getByRole('button', {name: /Cancel Subscription/}));

    expect(mock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: {
          reason: 'competitor',
          followup: 'Cancellation reason',
          checkboxes: [],
        },
      })
    );
  });

  it('calls cancel API with checkboxes', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'DELETE',
    });
    render(<CancelSubscription />);
    const radio = await screen.findByText("Sentry doesn't fit our needs.");
    expect(radio).toBeInTheDocument();

    await userEvent.click(radio);
    await userEvent.click(
      screen.getByRole('checkbox', {name: /Prefer to share feedback live/})
    );
    await userEvent.type(screen.getByRole('textbox'), 'Cancellation reason');
    await userEvent.click(screen.getByRole('button', {name: /Cancel Subscription/}));

    expect(mock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: {
          reason: 'not_a_fit',
          followup: 'Cancellation reason',
          checkboxes: ['reach_out'],
        },
      })
    );
  });
});
