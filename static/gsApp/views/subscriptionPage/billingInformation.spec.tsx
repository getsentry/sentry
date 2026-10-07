import type {StripeElements} from '@stripe/stripe-js';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {FTCConsentLocation} from 'getsentry/types';
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
    SubscriptionStore.init();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: subscription,
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

    // panels are collapsed with pre-existing information
    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    expect(screen.getByText('United States 94242')).toBeInTheDocument();
    expect(screen.getByText('Visa ****4242 12/77')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit payment method'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save Changes'})).not.toBeInTheDocument();

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('test@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Test company')).toBeInTheDocument();
    expect(screen.getByText('123 Street')).toBeInTheDocument();
    expect(screen.getByText('Toronto, ON M5A 0J5')).toBeInTheDocument();
    expect(screen.getByText('Canada')).toBeInTheDocument();
    expect(screen.getByText('GST/HST Number: 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Edit business address'})
    ).toBeInTheDocument();
    // can edit both
    await userEvent.click(screen.getByRole('button', {name: 'Edit payment method'}));
    expect(
      screen.queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Edit business address'}));
    expect(
      screen.queryByRole('button', {name: 'Edit business address'})
    ).not.toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();
  });

  it('renders with no pre-existing information', async () => {
    const sub: TSubscription = {...subscription, paymentSource: null};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    // panels are expanded with no pre-existing information
    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    expect(
      screen.queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    expect(
      screen.queryByRole('button', {name: 'Edit business address'})
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

    expect(
      screen.queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    expect(
      within(cardPanel).getByRole('button', {name: 'Save Changes'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your credit card will be charged upon update./)
    ).toBeInTheDocument();
  });

  it('renders balance due if account balance > 0', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    const sub: TSubscription = {...subscription, accountBalance: 100_00};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    expect(await screen.findByText('Balance due: $100')).toBeInTheDocument();
  });

  it('renders account credits if account balance < 0', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    const sub: TSubscription = {...subscription, accountBalance: -100_00};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    expect(await screen.findByText('Account credits: $100')).toBeInTheDocument();
  });

  it('hides account balance when it is 0', async () => {
    const sub = {...subscription, accountBalance: 0};
    SubscriptionStore.set(organization.slug, sub);

    render(<BillingInformation subscription={sub} />, {organization});

    await screen.findByText('Payment method');
    expect(screen.queryByText(/account credits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/balance due/i)).not.toBeInTheDocument();
  });

  it('can update credit card with setupintent', async () => {
    const testSubscription = SubscriptionFixture({organization});
    const updatedSubscription = {
      ...testSubscription,
      paymentSource: {
        last4: '1111',
        countryCode: 'US',
        zipCode: '94107',
        brand: 'Visa',
        expMonth: 12,
        expYear: 2030,
      },
    };

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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {
        paymentMethod: 'blahblahblah',
        ftcConsentLocation: FTCConsentLocation.BILLING_DETAILS,
      },
    });

    const {rerender} = render(<BillingInformation subscription={testSubscription} />, {
      organization,
    });

    await screen.findByText('Payment method');
    await userEvent.click(screen.getByRole('button', {name: 'Edit payment method'}));
    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});

    expect(
      screen.getByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).toBeInTheDocument();

    // Save the updated credit card details
    const saveButton = within(cardPanel).getByRole('button', {name: 'Save Changes'});
    expect(saveButton).toBeEnabled();
    await userEvent.click(saveButton);

    // Wait for the API call to complete
    await screen.findByRole('button', {name: 'Edit payment method'});

    // for testing purposes, update the store and rerender with the updated subscription
    // due to the nature of how the components are abstracted, this is necessary for testing
    // but in prod the UI refreshes on SubscriptionStore update
    SubscriptionStore.set(organization.slug, updatedSubscription);
    rerender(<BillingInformation subscription={updatedSubscription} />);
    expect(screen.getByText('Visa ****1111 12/30')).toBeInTheDocument();
    expect(screen.getByText('United States 94107')).toBeInTheDocument();
  });

  it('leaves Stripe field validation errors beside the fields', async () => {
    const stripeImport = await import('@stripe/react-stripe-js');
    const originalElements = stripeImport.useElements();
    const submit = jest.fn().mockResolvedValue({
      error: {message: 'Your card number is incomplete.'},
    });
    const useElementsSpy = jest.spyOn(stripeImport, 'useElements').mockReturnValue({
      submit,
    } as unknown as StripeElements);
    const createSetupIntent = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {clientSecret: 'seti_abc123'},
    });

    render(<BillingInformation subscription={subscription} />, {organization});

    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    await userEvent.click(screen.getByRole('button', {name: 'Edit payment method'}));
    await userEvent.click(within(cardPanel).getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(createSetupIntent).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    useElementsSpy.mockReturnValue(originalElements);
  });

  it('shows an error if the setupintent creation fails', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {
        paymentMethod: 'blahblahblah',
        ftcConsentLocation: FTCConsentLocation.BILLING_DETAILS,
      },
    });

    const testSubscription = SubscriptionFixture({organization});

    const createSetupIntent = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Unable to initialize payment setup, please try again later.',
      },
    });

    render(<BillingInformation subscription={testSubscription} />, {organization});

    await screen.findByText('Payment method');
    await userEvent.click(screen.getByRole('button', {name: 'Edit payment method'}));
    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});

    expect(createSetupIntent).not.toHaveBeenCalled();
    await userEvent.click(within(cardPanel).getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to initialize payment setup, please try again later.'
    );
  });

  it('shows a setup error when setup intent creation fails without a detail', async () => {
    const updatePaymentMethod = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
    });
    const createSetupIntent = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 400,
      body: {},
    });

    render(<BillingInformation subscription={subscription} />, {organization});

    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    await userEvent.click(
      within(cardPanel).getByRole('button', {name: 'Edit payment method'})
    );
    await userEvent.click(within(cardPanel).getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not set up payment method.'
    );
    expect(createSetupIntent).toHaveBeenCalledTimes(1);
    expect(updatePaymentMethod).not.toHaveBeenCalled();
  });

  it('shows a useful error when updating the payment method fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {clientSecret: 'seti_abc123'},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {},
    });

    const sub: TSubscription = {...subscription, paymentSource: null};
    render(<BillingInformation subscription={sub} />, {organization});

    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});
    await userEvent.click(within(cardPanel).getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update payment method.'
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

    const sub: TSubscription = {...subscription, paymentSource: null};

    render(<BillingInformation subscription={sub} />, {organization});

    const cardPanel = await screen.findByRole('region', {name: 'Payment method'});

    // Panel is already in edit mode because paymentSource is null
    // Save the updated credit card details
    await userEvent.click(within(cardPanel).getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('card invalid');
  });
});
