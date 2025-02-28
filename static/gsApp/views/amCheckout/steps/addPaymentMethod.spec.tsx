import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import AddPaymentMethod from 'getsentry/views/amCheckout/steps/addPaymentMethod';
import type {StepProps} from 'getsentry/views/amCheckout/types';

jest.mock('getsentry/utils/stripe', () => {
  return {
    loadStripe: (cb: (fn: () => {elements: any}) => void) => {
      if (!cb) {
        return;
      }
      cb(() => {
        return {
          elements: jest.fn(() => ({
            create: jest.fn(() => ({
              mount: jest.fn(),
              on(_name: any, handler: any) {
                handler();
              },
              update: jest.fn(),
            })),
          })),
        };
      });
    },
  };
});

describe('AddPaymentMethod', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const params = {};

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

  beforeEach(function () {
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

  it('cannot skip to step', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
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

  it('renders with existing card without postal code', async function () {
    const sub: SubscriptionType = {
      ...subscription,
      paymentSource: {
        last4: '4242',
        zipCode: '',
        countryCode: 'US',
        expMonth: 12,
        expYear: 2028,
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
    expect(screen.getByRole('textbox', {name: 'Postal Code'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('renders with existing card with postal code', function () {
    const sub: SubscriptionType = {
      ...subscription,
      paymentSource: {
        last4: '4242',
        zipCode: '94608',
        countryCode: 'US',
        expMonth: 12,
        expYear: 2028,
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

  it('renders without existing card', async function () {
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

  it('loads setupintent data', async function () {
    const sub = {...subscription, paymentSource: null};
    const props = {...stepProps, subscription: sub, organization};

    render(<AddPaymentMethod {...props} />);

    await waitFor(() => expect(setupIntent).toHaveBeenCalled());
  });

  it('can complete step', async function () {
    const onCompleteStep = jest.fn();
    const props = {...stepProps, onCompleteStep};

    render(<AddPaymentMethod {...props} />);

    const cardName = 'Existing card on file ending in 4242 Postal code 94242';
    expect(screen.getByRole('radio', {name: cardName})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(onCompleteStep).toHaveBeenCalledWith(stepNumber);
  });
});
