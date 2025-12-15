import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {FTCConsentLocation, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import AddPaymentMethod from 'getsentry/views/amCheckout/steps/addPaymentMethod';
import type {StepProps} from 'getsentry/views/amCheckout/types';

// Stripe mocks handled by global setup.ts

describe('AddPaymentMethod', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  let setupIntent!: jest.Mock;
  const stepNumber = 5;
  const billingConfig = BillingConfigFixture(PlanTier.AM2);
  const bizPlan = PlanDetailsLookupFixture('am1_business')!;

  const stepProps: StepProps = {
    isActive: true,
    stepNumber,
    onUpdate: jest.fn(),
    onCompleteStep: jest.fn(),
    onEdit: jest.fn(),
    billingConfig,
    formData: {
      plan: billingConfig.defaultPlan,
      reserved: {},
    },
    activePlan: bizPlan,
    subscription,
    organization,
    isCompleted: false,
    prevStepCompleted: false,
  };

  beforeEach(() => {
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    setupIntent = MockApiClient.addMockResponse({
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
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
    });
  });

  it('cannot skip to step', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={subscription.planTier as PlanTier}
      />,
      {organization}
    );

    expect(await screen.findByTestId('header-payment-method')).toBeInTheDocument();
    expect(screen.queryByTestId('body-payment-method')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('header-payment-method'));
    expect(screen.queryByTestId('body-payment-method')).not.toBeInTheDocument();
  });

  it('renders with existing card without postal code', async () => {
    const sub: SubscriptionType = {
      ...subscription,
      paymentSource: {
        last4: '4242',
        zipCode: '',
        countryCode: 'US',
        expMonth: 12,
        expYear: 2028,
        brand: 'Visa',
      },
    };

    render(<AddPaymentMethod {...stepProps} subscription={sub} />);

    expect(screen.getByTestId('header-payment-method')).toBeInTheDocument();
    expect(screen.getByTestId('body-payment-method')).toBeInTheDocument();
    expect(screen.getByTestId('footer-payment-method')).toBeInTheDocument();

    expect(
      screen.getByRole('radio', {name: 'Existing card on file ending in 4242'})
    ).toBeChecked();

    expect(screen.queryByLabelText('Card Details')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Add new card'}));

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());

    expect(screen.getByLabelText('Card Details')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('renders with existing card with postal code', () => {
    const sub: SubscriptionType = {
      ...subscription,
      paymentSource: {
        last4: '4242',
        zipCode: '94608',
        countryCode: 'US',
        expMonth: 12,
        expYear: 2028,
        brand: 'Visa',
      },
    };

    render(<AddPaymentMethod {...stepProps} subscription={sub} />);

    expect(screen.getByTestId('header-payment-method')).toBeInTheDocument();
    expect(screen.getByTestId('body-payment-method')).toBeInTheDocument();
    expect(screen.getByTestId('footer-payment-method')).toBeInTheDocument();

    const cardName = 'Existing card on file ending in 4242 Postal code 94608';
    expect(screen.getByRole('radio', {name: cardName})).toBeChecked();

    expect(screen.queryByLabelText('Card Details')).not.toBeInTheDocument();
  });

  it('renders without existing card', async () => {
    const sub = {...subscription, paymentSource: null};
    const props = {...stepProps, subscription: sub};

    render(<AddPaymentMethod {...props} />);

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());

    expect(screen.getByTestId('header-payment-method')).toBeInTheDocument();
    expect(screen.getByTestId('body-payment-method')).toBeInTheDocument();
    expect(screen.queryByTestId('footer-payment-method')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Card Details')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('loads setupintent data', async () => {
    const sub = {...subscription, paymentSource: null};
    const props = {...stepProps, subscription: sub, organization};

    render(<AddPaymentMethod {...props} />);

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());
  });

  it('can complete step', async () => {
    const onCompleteStep = jest.fn();
    const props = {...stepProps, onCompleteStep};

    render(<AddPaymentMethod {...props} />);

    const cardName = 'Existing card on file ending in 4242 Postal code 94242';
    expect(screen.getByRole('radio', {name: cardName})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(onCompleteStep).toHaveBeenCalledWith(stepNumber);
  });

  it('calls customer endpoint with correct ftcConsentLocation', async () => {
    const sub = {...subscription, paymentSource: null};
    const props = {...stepProps, subscription: sub, organization};

    const customerEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: organization,
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

    render(<AddPaymentMethod {...props} />);

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(customerEndpoint).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'test-pm',
          ftcConsentLocation: FTCConsentLocation.CHECKOUT,
        }),
      })
    );
  });

  it('displays fine print text on-demand', async () => {
    const sub = {...subscription, paymentSource: null};
    const props = {...stepProps, subscription: sub};

    render(<AddPaymentMethod {...props} />);

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());

    expect(
      screen.getByText(/Payments are processed securely through/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).toBeInTheDocument();
  });

  it('displays fine print text pay-as-you-go', async () => {
    const sub = {
      ...subscription,
      paymentSource: null,
      planDetails: PlanFixture({
        name: 'Team',
        contractInterval: 'annual',
        billingInterval: 'annual',
        onDemandCategories: [
          DataCategory.ERRORS,
          DataCategory.TRANSACTIONS,
          DataCategory.ATTACHMENTS,
        ],
        budgetTerm: 'pay-as-you-go',
      }),
    };
    const props = {...stepProps, subscription: sub};

    render(<AddPaymentMethod {...props} />);

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());

    expect(
      screen.getByText(/Payments are processed securely through/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable pay-as-you-go fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for pay-as-you-go fees. You may cancel your subscription at any time/
      )
    ).toBeInTheDocument();
  });
});
