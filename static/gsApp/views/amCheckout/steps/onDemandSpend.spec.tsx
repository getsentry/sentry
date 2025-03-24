import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';
import OnDemandSpend from 'getsentry/views/amCheckout/steps/onDemandSpend';
import type {StepProps} from 'getsentry/views/amCheckout/types';

describe('OnDemandSpend', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  const stepBody = /On-Demand spend allows you to pay for additional data/;

  const billingConfig = BillingConfigFixture(PlanTier.AM2);
  const bizPlan = PlanDetailsLookupFixture('am1_business')!;

  const stepProps: StepProps = {
    isActive: true,
    stepNumber: 3,
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
    isCompleted: false,
    prevStepCompleted: false,
    organization,
  };

  async function openPanel() {
    const header = await screen.findByTestId('header-on-demand-max-spend');
    expect(header).toBeInTheDocument();
    await userEvent.click(within(header).getByLabelText('Expand section'));
  }

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('renders with placeholder and can change input', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toBeEnabled();
    expect(screen.queryByLabelText(/On-demand is not supported/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 50')).toBeInTheDocument();

    // Can type into the input.
    await userEvent.type(screen.getByPlaceholderText('e.g. 50'), '50');
  });

  it('handles input edge cases', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    const input = screen.getByRole('textbox', {name: 'Monthly Max'});

    await userEvent.type(input, 'a');
    expect(input).toHaveValue('');

    await userEvent.type(input, '-50');
    expect(input).toHaveValue('50');

    await userEvent.type(input, '-');
    expect(input).toHaveValue('50');

    await userEvent.clear(input);
    await userEvent.type(input, '10e');
    expect(input).toHaveValue('10');

    await userEvent.clear(input);
    await userEvent.type(input, 'e');
    expect(input).toHaveValue('');

    await userEvent.clear(input);
    await userEvent.type(input, '75..');
    expect(input).toHaveValue('75');

    await userEvent.clear(input);
    await userEvent.type(input, '.');
    expect(input).toHaveValue('');
  });

  it('can complete step', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    // Body text is present.
    expect(screen.getByText(stepBody)).toBeInTheDocument();

    // continue to close
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.queryByText(stepBody)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Monthly Max'})).not.toBeInTheDocument();
  });

  it('is disabled if sub does not support ondemand', async function () {
    const sub = {...subscription, supportsOnDemand: false};
    SubscriptionStore.set(organization.slug, sub);

    render(<OnDemandSpend {...stepProps} subscription={sub} />);

    // Check tooltip
    await userEvent.hover(screen.getByRole('textbox', {name: 'Monthly Max'}));
    expect(await screen.findByText(/On-demand is not supported/)).toBeInTheDocument();

    const input = screen.getByRole('textbox', {name: 'Monthly Max'});
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('is disabled if plan does not allow on demand', async function () {
    const activePlan = {...bizPlan, allowOnDemand: false};
    const props = {...stepProps, activePlan};

    render(<OnDemandSpend {...props} />);

    // Check tooltip
    await userEvent.hover(screen.getByRole('textbox', {name: 'Monthly Max'}));
    expect(await screen.findByText(/On-demand is not supported/)).toBeInTheDocument();

    const input = screen.getByRole('textbox', {name: 'Monthly Max'});
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
  });
});
