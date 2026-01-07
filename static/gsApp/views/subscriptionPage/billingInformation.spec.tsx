import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {BillingInformation} from 'getsentry/views/subscriptionPage/billingInformation';

// Stripe mocks handled by global setup.ts
// TODO(isabella): tbh most of these tests should be in a spec for the individual panel components

describe('Subscription > BillingInformation', () => {
  const {organization} = initializeOrg({
    organization: {access: ['org:billing']},
  });
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      body: {},
      method: 'POST',
    });
    organization.features = [];
  });

  it('renders an error for non-billing roles', async () => {
    const org = {...organization, access: OrganizationFixture().access};

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      body: [],
    });

    render(<BillingInformation subscription={subscription} />, {organization: org});

    await screen.findByText('Insufficient Access');
    expect(
      screen.queryByRole('textbox', {name: /street address 1/i})
    ).not.toBeInTheDocument();
  });

  it('renders with pre-existing information', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture({
        taxNumber: '1',
        countryCode: 'CA',
        city: 'Toronto',
        region: 'ON',
        postalCode: 'M5A 0J5',
      }),
    });

    render(<BillingInformation subscription={subscription} />, {organization});

    await screen.findByText('Billing Information');

    // panels are collapsed with pre-existing information
    const cardPanel = await screen.findByTestId('credit-card-panel');
    expect(within(cardPanel).getByText('United States 94242')).toBeInTheDocument();
    expect(within(cardPanel).getByText('Visa ****4242 12/77')).toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Edit payment method'})
    ).toBeInTheDocument();
    expect(
      within(cardPanel).queryByRole('button', {name: 'Save Changes'})
    ).not.toBeInTheDocument();

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    expect(within(billingDetailsPanel).getByText('Business address')).toBeInTheDocument();
    expect(within(billingDetailsPanel).getByText('test@gmail.com')).toBeInTheDocument();
    expect(within(billingDetailsPanel).getByText('Test company')).toBeInTheDocument();
    expect(within(billingDetailsPanel).getByText('123 Street')).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByText('Toronto, ON M5A 0J5')
    ).toBeInTheDocument();
    expect(within(billingDetailsPanel).getByText('Canada')).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByText('GST/HST Number: 1')
    ).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByRole('button', {name: 'Edit business address'})
    ).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).queryByRole('button', {name: 'Save Changes'})
    ).not.toBeInTheDocument();

    // can edit both
    await userEvent.click(
      within(cardPanel).getByRole('button', {name: 'Edit payment method'})
    );
    expect(
      within(cardPanel).queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();

    await userEvent.click(
      within(billingDetailsPanel).getByRole('button', {name: 'Edit business address'})
    );
    expect(
      within(billingDetailsPanel).queryByRole('button', {name: 'Edit business address'})
    ).not.toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();
  });

  it('renders with no pre-existing information', async () => {
    const sub: TSubscription = {...subscription, paymentSource: null};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    await screen.findByText('Billing Information');

    // panels are expanded with no pre-existing information
    const cardPanel = await screen.findByTestId('credit-card-panel');
    expect(cardPanel).toBeInTheDocument();
    expect(
      within(cardPanel).queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    expect(billingDetailsPanel).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).queryByRole('button', {name: 'Edit business address'})
    ).not.toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();
  });

  it('opens credit card form with billing failure query', async () => {
    render(<BillingInformation subscription={subscription} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/org-slug/billing/details/',
          query: {referrer: 'billing-failure'},
        },
      },
    });

    await screen.findByText('Payment method');
    expect(
      screen.queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeInTheDocument();

    expect(
      screen.getByText(/Your credit card will be charged upon update./)
    ).toBeInTheDocument();
  });

  it('renders without credit if account balance > 0', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    const sub: TSubscription = {...subscription, accountBalance: 100_00};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    await screen.findByText('Billing Information');
    expect(screen.getByText('Account balance: $100')).toBeInTheDocument();
  });

  it('renders with credit if account balance < 0', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    const sub: TSubscription = {...subscription, accountBalance: -100_00};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    await screen.findByText('Billing Information');
    expect(screen.getByText('Account balance: $100 credit')).toBeInTheDocument();
  });

  it('hides account balance when it is 0', async () => {
    const sub = {...subscription, accountBalance: 0};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    await screen.findByText('Billing Information');
    expect(screen.queryByText(/account balance/i)).not.toBeInTheDocument();
  });

  it('can update credit card with setupintent', async () => {
    const updatedSubscription = {
      ...subscription,
      paymentSource: {
        last4: '1111',
        countryCode: 'US',
        zipCode: '94107',
        brand: 'Visa',
        expMonth: 12,
        expYear: 2030,
      },
    };

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: updatedSubscription,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {
        id: '123',
        clientSecret: 'seti_abc123',
        status: 'require_payment_method',
        lastError: null,
      },
    });

    const {rerender} = render(<BillingInformation subscription={subscription} />, {
      organization,
    });

    await screen.findByText('Billing Information');
    const cardPanel = await screen.findByTestId('credit-card-panel');
    const inCardPanel = within(cardPanel);

    // Click edit button to expand the panel
    await userEvent.click(inCardPanel.getByRole('button', {name: 'Edit payment method'}));

    expect(
      inCardPanel.getByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).toBeInTheDocument();

    // Save the updated credit card details
    await userEvent.click(inCardPanel.getByRole('button', {name: 'Save Changes'}));

    // Wait for the API call to complete
    await waitFor(() => expect(updateMock).toHaveBeenCalled());

    // for testing purposes, update the store and rerender with the updated subscription
    // due to the nature of how the components are abstracted, this is necessary for testing
    // but in prod the UI refreshes on SubscriptionStore update
    SubscriptionStore.set(organization.slug, updatedSubscription);
    rerender(<BillingInformation subscription={updatedSubscription} />);
    expect(inCardPanel.getByText('Visa ****1111 12/30')).toBeInTheDocument();
    expect(inCardPanel.getByText('United States 94107')).toBeInTheDocument();
  });

  it('shows an error if the setupintent creation fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 400,
    });

    render(<BillingInformation subscription={subscription} />, {organization});

    await screen.findByText('Billing Information');
    const cardPanel = await screen.findByTestId('credit-card-panel');
    const inCardPanel = within(cardPanel);

    // Click edit button to expand the panel
    await userEvent.click(inCardPanel.getByRole('button', {name: 'Edit payment method'}));

    await inCardPanel.findByText(
      'Unable to initialize payment setup, please try again later.'
    );
  });

  it('shows an error when confirmSetup fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {
        id: '999',
        clientSecret: 'ERROR', // Interacts with the mocks above.
        status: 'require_payment_method',
        lastError: null,
      },
    });

    render(<BillingInformation subscription={subscription} />, {organization});

    await screen.findByText('Billing Information');
    const cardPanel = await screen.findByTestId('credit-card-panel');
    const inCardPanel = within(cardPanel);

    // Click edit button to expand the panel
    await userEvent.click(inCardPanel.getByRole('button', {name: 'Edit payment method'}));

    // Save the updated credit card details
    await userEvent.click(inCardPanel.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('card invalid')).toBeInTheDocument();
  });

  it('uses stripe components when flag is enabled', async () => {
    organization.features = ['stripe-components'];

    render(<BillingInformation subscription={subscription} />, {organization});

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    const inBillingDetailsPanel = within(billingDetailsPanel);

    // check for our custom fields outside of the Stripe components
    // already open because /billing-details is not mocked
    expect(
      inBillingDetailsPanel.getByRole('textbox', {name: 'Billing email'})
    ).toBeInTheDocument();

    // There shouldn't be any of the fields from the LegacyBillingDetailsForm
    expect(
      inBillingDetailsPanel.queryByRole('textbox', {name: 'Street Address 1'})
    ).not.toBeInTheDocument();
  });
});
