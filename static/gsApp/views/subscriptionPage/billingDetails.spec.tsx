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
  within,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {BillingDetails as BillingDetailsView} from 'getsentry/views/subscriptionPage/billingDetails';

jest.mock('getsentry/utils/stripe', () => ({
  loadStripe: (cb: any) => {
    cb(() => ({
      createToken: jest.fn(
        () =>
          new Promise(resolve => {
            resolve({token: {id: 'STRIPE_TOKEN'}});
          })
      ),
      confirmCardSetup(secretKey: string, _options: any) {
        if (secretKey !== 'ERROR') {
          return new Promise(resolve => {
            resolve({setupIntent: {payment_method: 'pm_abc123'}});
          });
        }
        return new Promise(resolve => {
          resolve({error: {message: 'card invalid'}});
        });
      },
      elements: jest.fn(() => ({
        create: jest.fn(() => ({
          mount: jest.fn(),
          on: jest.fn(),
          update: jest.fn(),
        })),
      })),
    }));
  },
}));

describe('Subscription > BillingDetails', function () {
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
  });

  it('renders an error for non-billing roles', async function () {
    const org = {...organization, access: OrganizationFixture().access};

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      body: [],
    });

    render(
      <BillingDetailsView
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

  it('renders with subscription', async function () {
    render(
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    const section = await screen.findByTestId('account-balance');
    expect(within(section).getByText(/account balance/i)).toBeInTheDocument();
    expect(within(section).getByText('$100 credit')).toBeInTheDocument();
  });

  it('renders without credit if account balance > 0', async function () {
    const sub: TSubscription = {...subscription, accountBalance: 10_000};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <BillingDetailsView
        organization={organization}
        subscription={sub}
        location={router.location}
      />
    );

    const section = await screen.findByTestId('account-balance');
    expect(within(section).getByText(/account balance/i)).toBeInTheDocument();
    expect(within(section).getByText('$100')).toBeInTheDocument();
    expect(within(section).queryByText('credit')).not.toBeInTheDocument();
  });

  it('hides account balance when it is 0', async function () {
    const sub = {...subscription, accountBalance: 0};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <BillingDetailsView
        organization={organization}
        subscription={sub}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    expect(screen.queryByText(/account balance/i)).not.toBeInTheDocument();
  });

  it('renders credit card details', async () => {
    render(
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: 'Street Address 1'});
    expect(screen.getByRole('textbox', {name: 'Postal Code'})).toBeInTheDocument();
    expect(screen.getByText('94242')).toBeInTheDocument();
    expect(screen.getByText(/credit card number/i)).toBeInTheDocument();
    expect(screen.getByText('xxxx xxxx xxxx 4242')).toBeInTheDocument();
  });

  it('can update credit card with setupintent', async function () {
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
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    const {waitForModalToHide} = renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // Postal code input is not handled by Stripe elements. We need to fill it
    // before submit will pass to Stripe
    await userEvent.type(inModal.getByRole('textbox', {name: 'Postal Code'}), '94107');

    // Save the updated credit card details
    await userEvent.click(inModal.getByRole('button', {name: 'Save Changes'}));
    await waitForModalToHide();

    // Save billing details
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'pm_abc123',
        }),
      })
    );

    expect(screen.getByText('xxxx xxxx xxxx 1111')).toBeInTheDocument();
    expect(screen.getByText('94107')).toBeInTheDocument();
    SubscriptionStore.get(subscription.slug, function (sub) {
      expect(sub.paymentSource?.last4).toBe('1111');
    });
  });

  it('rejects update credit card if zip code is not included with setupintent', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
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
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', {name: 'Save Changes'}));

    expect(modal).toHaveTextContent('Postal code is required');
    expect(mock).not.toHaveBeenCalledWith();
  });

  it('shows an error if the setupintent creation fails', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 400,
    });

    render(
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('Unable to initialize payment setup');
  });

  it('shows an error when confirmSetup fails', async function () {
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
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
    await userEvent.click(screen.getByRole('button', {name: 'Update card'}));

    renderGlobalModal();
    const modal = await screen.findByRole('dialog');
    const inModal = within(modal);

    // Postal code input is not handled by Stripe elements. We need to fill it
    // before submit will pass to Stripe
    await userEvent.type(inModal.getByRole('textbox', {name: 'Postal Code'}), '94107');

    // Save the updated credit card details
    await userEvent.click(inModal.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('card invalid')).toBeInTheDocument();
  });

  it('renders open credit card modal with billing failure query', async function () {
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
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});
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

describe('Billing details form', function () {
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
  });

  it('renders billing details form', async function () {
    render(
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: 'Street Address 1'});
    expect(screen.getByRole('textbox', {name: 'Street Address 2'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'City'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'State / Region'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Postal Code'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Company Name'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Billing Email'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Vat Number'})).not.toBeInTheDocument();
  });

  it('can submit form', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });

    render(
      <BillingDetailsView
        organization={organization}
        subscription={subscription}
        location={router.location}
      />
    );

    await screen.findByRole('textbox', {name: /street address 1/i});

    // renders initial data
    expect(screen.getByDisplayValue('123 Street')).toBeInTheDocument();
    expect(screen.getByDisplayValue('San Francisco')).toBeInTheDocument();
    expect(screen.getByText('California')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345')).toBeInTheDocument();

    // update field
    await userEvent.clear(screen.getByRole('textbox', {name: /postal code/i}));
    await userEvent.type(screen.getByRole('textbox', {name: /postal code/i}), '98765');

    await userEvent.click(screen.getByRole('button', {name: /save changes/i}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-details/`,
      expect.objectContaining({
        method: 'PUT',
        data: {...BillingDetailsFixture(), postalCode: '98765'},
      })
    );
  });
});
