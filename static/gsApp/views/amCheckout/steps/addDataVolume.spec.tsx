import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, render, screen, within} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import AddDataVolume from 'getsentry/views/amCheckout/steps/addDataVolume';

describe('AddDataVolume', function () {
  const api = new MockApiClient();
  const {organization, router, routerProps} = initializeOrg();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  const billingConfig = BillingConfigFixture(PlanTier.AM2);
  const bizPlan = PlanDetailsLookupFixture('am1_business')!;
  const teamPlanAnnual = PlanDetailsLookupFixture('am1_team_auf')!;
  const am2TeamPlanAnnual = PlanDetailsLookupFixture('am2_team_auf')!;

  const stepProps = {
    checkoutTier: PlanTier.AM2,
    subscription,
    isActive: true,
    stepNumber: 2,
    onUpdate: jest.fn(),
    onCompleteStep: jest.fn(),
    onEdit: jest.fn(),
    billingConfig,
    formData: {
      plan: billingConfig.defaultPlan,
      reserved: billingConfig.defaultReserved,
    },
    activePlan: bizPlan,
    isCompleted: false,
    organization,
    prevStepCompleted: true,
  };

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
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
  });

  it('renders a heading', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );

    const heading = await screen.findByText('Reserved Volumes');
    expect(heading).toBeInTheDocument();
  });

  it('renders with default event volumes', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );

    // Open section by clicking on heading.
    const heading = await screen.findByText('Reserved Volumes');
    fireEvent.click(heading);

    const errors = screen.getByTestId('errors-volume-item').textContent;
    expect(errors).toContain('50,000');
    expect(errors).toContain('included');

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).toContain('100,000');
    expect(transactions).toContain('included');

    const attachments = screen.getByTestId('attachments-volume-item').textContent;
    expect(attachments).toContain('1 GB');
    expect(attachments).toContain('included');

    const replays = screen.getByTestId('replays-volume-item').textContent;
    expect(replays).toContain('500');
    expect(replays).toContain('included');

    const monitorSeats = screen.getByTestId('monitorSeats-volume-item').textContent;
    expect(monitorSeats).toContain('1');
    expect(monitorSeats).toContain('included');

    const uptime = screen.getByTestId('uptime-volume-item').textContent;
    expect(uptime).toContain('1');
    expect(uptime).toContain('included');
  });

  it('renders additional event volume prices, business plan', function () {
    const props = {
      ...stepProps,
      formData: {
        plan: 'am2',
        reserved: {
          errors: 100_000,
          transactions: 500_000,
          attachments: 50,
          replays: 10_000,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    const errors = screen.getByTestId('errors-volume-item').textContent;
    expect(errors).toContain('100,000');
    expect(errors).toContain('$45/mo');
    expect(errors).toContain('$0.00050 per event');
    expect(errors).toContain('50K');
    expect(errors).toContain('50M');

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).toContain('500,000');
    expect(transactions).toContain('$90/mo');
    expect(transactions).toContain('$0.00013 per event');
    expect(transactions).toContain('100K');
    expect(transactions).toContain('30M');

    const attachments = screen.getByTestId('attachments-volume-item').textContent;
    expect(attachments).toContain('50 GB');
    expect(attachments).toContain('$12/mo');
    expect(attachments).toContain('$0.25');
    expect(attachments).toContain('1GB');
    expect(attachments).toContain('1,000GB');

    const replays = screen.getByTestId('replays-volume-item').textContent;
    expect(replays).toContain('10,000');
    expect(replays).toContain('$29/mo');
    expect(replays).toContain('$0.00288 per event');
    expect(replays).toContain('500');
    expect(replays).toContain('10M');

    const monitorSeats = screen.getByTestId('monitorSeats-volume-item').textContent;
    expect(monitorSeats).toContain('1');
    expect(monitorSeats).toContain('included');
  });

  it('renders event volume prices, team annual plan', function () {
    const props = {
      ...stepProps,
      activePlan: teamPlanAnnual,
      formData: {
        plan: 'am2',
        reserved: {
          errors: 200_000,
          transactions: 500_000,
          attachments: 25,
          replays: 25_000,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    const errors = screen.getByTestId('errors-volume-item').textContent;
    expect(errors).toContain('200,000');
    expect(errors).toContain('$352/yr');
    expect(errors).not.toContain('dynamically sample');

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).toContain('500,000');
    expect(transactions).toContain('$324/yr');
    expect(errors).not.toContain('dynamically sample');

    const attachments = screen.getByTestId('attachments-volume-item').textContent;
    expect(attachments).toContain('25 GB');
    expect(attachments).toContain('$63/yr');
    expect(errors).not.toContain('dynamically sample');

    const replays = screen.getByTestId('replays-volume-item').textContent;
    expect(replays).toContain('25,000');
    expect(replays).toContain('$780/yr');
    expect(errors).not.toContain('dynamically sample');

    const monitorSeats = screen.getByTestId('monitorSeats-volume-item').textContent;
    expect(monitorSeats).toContain('1');
    expect(monitorSeats).toContain('included');
    expect(errors).not.toContain('dynamically sample');
  });

  it('can complete step', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );
    const panel = await screen.findByTestId('step-add-data-volume');
    const heading = within(panel).getByText('Reserved Volumes');
    fireEvent.click(heading);

    // Click continue to collapse the panel again
    const button = within(panel).getByLabelText('Continue');
    fireEvent.click(button);

    // The button should be gone now.
    expect(within(panel).queryByLabelText('Continue')).not.toBeInTheDocument();
  });

  it('am2 checkout displays dynamic sampling alert', function () {
    const props = {
      ...stepProps,
      activePlan: am2TeamPlanAnnual,
      formData: {
        plan: 'am2',
        reserved: {
          errors: 200_000,
          transactions: 500_000,
          attachments: 25,
          replays: 10_000,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    const errors = screen.getByTestId('errors-volume-item').textContent;
    expect(errors).toContain('200,000');
    expect(errors).toContain('$352/yr');
    expect(errors).not.toContain('dynamically sample');

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).toContain('500,000');
    expect(transactions).toContain('$324/yr');
    expect(transactions).toContain('dynamically sample');

    const attachments = screen.getByTestId('attachments-volume-item').textContent;
    expect(attachments).toContain('25 GB');
    expect(attachments).toContain('$63/yr');
    expect(attachments).not.toContain('dynamically sample');

    const replays = screen.getByTestId('replays-volume-item').textContent;
    expect(replays).toContain('10,000');
    expect(replays).toContain('$312/yr');
    expect(replays).not.toContain('dynamically sample');

    const monitorSeats = screen.getByTestId('monitorSeats-volume-item').textContent;
    expect(monitorSeats).toContain('1');
    expect(monitorSeats).toContain('included');
    expect(monitorSeats).not.toContain('dynamically sample');
  });

  it('displays performance unit types with feature', function () {
    const org = OrganizationFixture({features: ['profiling-billing']});
    const props = {
      ...stepProps,
      organization: org,
      activePlan: am2TeamPlanAnnual,
      formData: {
        plan: 'am2',
        reserved: {
          errors: 200_000,
          transactions: 500_000,
          attachments: 25,
          replays: 500,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).toContain('Total Units');
    expect(transactions).toContain('Sentry Performance');
    expect(transactions).toContain('per unit');
    expect(transactions).toContain('200M');
  });

  it('does not display performance unit types without feature', function () {
    const props = {
      ...stepProps,
      organization,
      activePlan: am2TeamPlanAnnual,
      formData: {
        plan: 'am2',
        reserved: {
          errors: 200_000,
          transactions: 500_000,
          attachments: 25,
          replays: 500,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    const transactions = screen.getByTestId('transactions-volume-item').textContent;
    expect(transactions).not.toContain('Total Units');
    expect(transactions).not.toContain('Sentry Performance');
    expect(transactions).toContain('per event');
  });
});
