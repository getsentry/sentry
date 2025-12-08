import {act} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {FTCConsentLocation, PlanTier} from 'getsentry/types';
import {BillingInformation} from 'getsentry/views/subscriptionPage/billingInformation';

// Stripe mocks handled by global setup.ts
// TODO(isabella): tbh most of these tests should be in a spec for the individual panel components

describe('Subscription > BillingInformation', () => {
  const {organization, router} = initializeOrg({
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

    render(
      <BillingInformation
        organization={org}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Insufficient Access');
    expect(
      screen.queryByRole('textbox', {name: /street address 1/i})
    ).not.toBeInTheDocument();
  });

  it('renders with subscription', async () => {
    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByLabelText(/account balance/i);
    expect(screen.getByText('$100 credit')).toBeInTheDocument();
  });

  it('renders for new billing UI with pre-existing information', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    organization.features = ['subscriptions-v3'];

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Billing Information');

    // panels are collapsed with pre-existing information
    const cardPanel = await screen.findByTestId('credit-card-panel');
    expect(within(cardPanel).getByText(/\*\*\*\*4242/)).toBeInTheDocument();
    expect(
      within(cardPanel).getByRole('button', {name: 'Edit payment method'})
    ).toBeInTheDocument();
    expect(
      within(cardPanel).queryByRole('button', {name: 'Save Changes'})
    ).not.toBeInTheDocument();

    const billingDetailsPanel = await screen.findByTestId('billing-details-panel');
    expect(within(billingDetailsPanel).getByText('Business address')).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).getByRole('button', {name: 'Edit business address'})
    ).toBeInTheDocument();
    expect(
      within(billingDetailsPanel).queryByText('Address Line 1')
    ).not.toBeInTheDocument();
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

  it('renders with no pre-existing information for new billing UI', async () => {
    organization.features = ['subscriptions-v3'];
    const sub: TSubscription = {...subscription, paymentSource: null};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <BillingInformation
        organization={organization}
        subscription={sub}
        location={router.location}
      />
    );

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

  it('opens credit card form with billing failure query for new billing UI', async () => {
    organization.features = ['subscriptions-v3'];
    router.location = {
      ...router.location,
      query: {referrer: 'billing-failure'},
    };

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

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
    const sub: TSubscription = {...subscription, accountBalance: 10_000};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <BillingInformation
        organization={organization}
        subscription={sub}
        location={router.location}
      />
    );

    await screen.findByLabelText(/account balance/i);
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByText('$100 credit')).not.toBeInTheDocument();
  });

  it('hides account balance when it is 0', async () => {
    const sub = {...subscription, accountBalance: 0};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <BillingInformation
        organization={organization}
        subscription={sub}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    expect(screen.queryByText(/account balance/i)).not.toBeInTheDocument();
  });

  it('renders credit card details', async () => {
    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    expect(screen.getAllByText('Postal Code')).toHaveLength(2);
    expect(screen.getByText('94242')).toBeInTheDocument();
    expect(screen.getByText(/credit card number/i)).toBeInTheDocument();
    expect(screen.getByText('xxxx xxxx xxxx 4242')).toBeInTheDocument();
  });

  it('can update credit card with setupintent', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {
        ...subscription,
        paymentSource: {
          last4: '1111',
          countryCode: 'US',
          zipCode: '94107',
        },
      },
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

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    const {waitForModalToHide} = renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    expect(
      inModal.getByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).toBeInTheDocument();

    // Save the updated credit card details
    await userEvent.click(inModal.getByRole('button', {name: 'Save Changes'}));
    await waitForModalToHide();

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'test-pm',
          ftcConsentLocation: FTCConsentLocation.BILLING_DETAILS,
        }),
      })
    );

    expect(screen.getByText('xxxx xxxx xxxx 1111')).toBeInTheDocument();
    expect(screen.getByText('94107')).toBeInTheDocument();
    SubscriptionStore.get(subscription.slug, sub => {
      expect(sub.paymentSource?.last4).toBe('1111');
    });
  });

  it('shows an error if the setupintent creation fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 400,
    });

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(modal).toHaveTextContent('Unable to initialize payment setup');
    });
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

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // Save the updated credit card details
    await userEvent.click(inModal.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('card invalid')).toBeInTheDocument();
  });

  it('renders open credit card modal with billing failure query', async () => {
    router.location = {
      ...router.location,
      query: {referrer: 'billing-failure'},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {},
    });

    renderGlobalModal();
    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByText('Address Line 1');
    expect(
      screen.getByText(/Your credit card will be charged upon update./)
    ).toBeInTheDocument();
    expect(screen.getByText(/Manage Subscription/)).toBeInTheDocument();
    expect(screen.getByText(/Update Credit Card/)).toBeInTheDocument();
    expect(
      screen.getByText(/Payments are processed securely through/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
  });
});

describe('Billing details form', () => {
  const {router} = initializeOrg();
  const organization = OrganizationFixture({
    access: ['org:billing'],
  });
  const subscription = SubscriptionFixture({organization});

  let updateMock: any;

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
      body: subscription,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    organization.features = [];
  });

  it('renders billing details form', async () => {
    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('button', {name: 'Update details'});
    await userEvent.click(screen.getByRole('button', {name: 'Update details'}));
    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    expect(inModal.getByRole('textbox', {name: 'Street Address 1'})).toBeInTheDocument();
    expect(inModal.getByRole('textbox', {name: 'Street Address 2'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Country'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'City'})).toBeInTheDocument();
    expect(inModal.getByRole('textbox', {name: 'State / Region'})).toBeInTheDocument();
    expect(inModal.getByRole('textbox', {name: 'Postal Code'})).toBeInTheDocument();
    expect(inModal.getByRole('textbox', {name: 'Company Name'})).toBeInTheDocument();
    expect(inModal.getByRole('textbox', {name: 'Billing Email'})).toBeInTheDocument();
    expect(inModal.queryByRole('textbox', {name: 'Vat Number'})).not.toBeInTheDocument();
  });

  it('can submit form', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('button', {name: 'Update details'});
    await userEvent.click(screen.getByRole('button', {name: 'Update details'}));
    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // renders initial data
    expect(inModal.getByDisplayValue('123 Street')).toBeInTheDocument();
    expect(inModal.getByDisplayValue('San Francisco')).toBeInTheDocument();
    expect(inModal.getByText('California')).toBeInTheDocument();
    expect(inModal.getByText('United States')).toBeInTheDocument();
    expect(inModal.getByDisplayValue('12345')).toBeInTheDocument();

    // update field
    await userEvent.clear(inModal.getByRole('textbox', {name: /postal code/i}));
    await userEvent.type(inModal.getByRole('textbox', {name: /postal code/i}), '98765');

    await userEvent.click(inModal.getByRole('button', {name: /save changes/i}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-details/`,
      expect.objectContaining({
        method: 'PUT',
        data: {...BillingDetailsFixture(), postalCode: '98765'},
      })
    );
  });

  it('displays tax number field for country with sales tax', async () => {
    const billingDetailsWithPhilippines = BillingDetailsFixture({
      countryCode: 'PH',
      taxNumber: '123456789000',
    });

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: billingDetailsWithPhilippines,
    });

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('button', {name: 'Update details'});
    await userEvent.click(screen.getByRole('button', {name: 'Update details'}));
    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // Philippines should display TIN field
    expect(inModal.getByRole('textbox', {name: 'TIN'})).toBeInTheDocument();
    expect(inModal.getByDisplayValue('123456789000')).toBeInTheDocument();

    // Help text should mention Taxpayer Identification Number
    expect(inModal.getByText(/Taxpayer Identification Number/)).toBeInTheDocument();
  });

  it('uses stripe components when flag is enabled', async () => {
    organization.features = ['stripe-components'];

    render(
      <BillingInformation
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('button', {name: 'Update details'});

    await act(async () => {
      await userEvent.click(screen.getByRole('button', {name: 'Update details'}));
      renderGlobalModal();
    });
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // check for our custom fields outside of the Stripe components
    expect(inModal.getByRole('textbox', {name: 'Billing email'})).toBeInTheDocument();

    // There shouldn't be any of the fields from the LegacyBillingDetailsForm
    expect(
      inModal.queryByRole('textbox', {name: 'Street Address 1'})
    ).not.toBeInTheDocument();
  });

  it('displays credit card expiration date', async () => {
    organization.features = ['subscriptions-v3'];

    const subscriptionWithCard = SubscriptionFixture({
      organization,
      paymentSource: {
        last4: '4242',
        countryCode: 'US',
        zipCode: '94242',
        expMonth: 8,
        expYear: 2030,
        brand: 'Visa',
      },
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscriptionWithCard,
    });

    render(
      <BillingInformation
        organization={organization}
        subscription={subscriptionWithCard}
        location={router.location}
      />
    );

    await screen.findByText('Billing Information');

    const cardPanel = await screen.findByTestId('credit-card-panel');

    // Verify payment method displays with correct expiration date format (MM/YY)
    expect(within(cardPanel).getByText(/\*\*\*\*4242 08\/30/)).toBeInTheDocument();
  });
});
