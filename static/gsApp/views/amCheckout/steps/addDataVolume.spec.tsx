import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ANNUAL, MONTHLY} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import AddDataVolume from 'getsentry/views/amCheckout/steps/addDataVolume';

type SliderInfo = {
  billingInterval: string;
  category: string;
  max: string;
  min: string;
  selectedTier: string;
  hasDynamicSampling?: boolean;
  pricePerEvent?: string;
  tierPrice?: number;
};

function assertSlider({
  category,
  selectedTier,
  billingInterval,
  min,
  max,
  tierPrice,
  pricePerEvent,
  hasDynamicSampling,
}: SliderInfo) {
  const slider = screen.getByTestId(`${category}-volume-item`).textContent;
  expect(slider).toContain(selectedTier);
  expect(slider).toContain(min);
  expect(slider).toContain(max);
  if (pricePerEvent) {
    expect(slider).toContain(pricePerEvent);
  }

  const intervalAbbreviation = billingInterval === MONTHLY ? 'mo' : 'yr';
  if (tierPrice) {
    expect(slider).toContain(`${tierPrice}/${intervalAbbreviation}`);
    expect(slider).not.toContain('included');
  } else {
    expect(slider).toContain('included');
    expect(slider).not.toContain(`/${intervalAbbreviation}`);
  }

  if (hasDynamicSampling) {
    expect(slider).toContain('dynamically sample');
  } else {
    expect(slider).not.toContain('dynamically sample');
  }
}

function assertSliders(sliderInfo: SliderInfo[]) {
  sliderInfo.forEach(info => assertSlider(info));
  expect(screen.getAllByRole('slider')).toHaveLength(sliderInfo.length);
}

describe('AddDataVolume for legacy plans', function () {
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
    await userEvent.click(heading);

    assertSliders([
      {
        billingInterval: MONTHLY,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '50,000',
      },
      {
        billingInterval: MONTHLY,
        category: 'transactions',
        max: '200M',
        min: '100K',
        selectedTier: '100,000',
        hasDynamicSampling: true,
      },
      {
        billingInterval: MONTHLY,
        category: 'attachments',
        max: '1,000GB',
        min: '1GB',
        selectedTier: '1 GB',
      },
      {
        billingInterval: MONTHLY,
        category: 'replays',
        max: '10M',
        min: '500',
        selectedTier: '500',
      },
    ]);
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

    assertSliders([
      {
        billingInterval: MONTHLY,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '100,000',
        tierPrice: 45,
        pricePerEvent: '$0.00050 per event',
      },
      {
        billingInterval: MONTHLY,
        category: 'transactions',
        max: '30M',
        min: '100K',
        selectedTier: '500,000',
        tierPrice: 90,
        pricePerEvent: '$0.00013 per event',
      },
      {
        billingInterval: MONTHLY,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '50 GB',
        tierPrice: 12,
        pricePerEvent: '$0.25',
      },
      {
        billingInterval: MONTHLY,
        category: 'replays',
        max: '10M',
        min: '500',
        selectedTier: '10,000',
        tierPrice: 29,
        pricePerEvent: '$0.00288 per event',
      },
    ]);
  });

  it('renders event volume prices, team annual plan', function () {
    const props = {
      ...stepProps,
      activePlan: teamPlanAnnual,
      formData: {
        plan: teamPlanAnnual.id,
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

    assertSliders([
      {
        billingInterval: ANNUAL,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '200,000',
        tierPrice: 352,
      },
      {
        billingInterval: ANNUAL,
        category: 'transactions',
        max: '30M',
        min: '100K',
        selectedTier: '500,000',
        tierPrice: 324,
      },
      {
        billingInterval: ANNUAL,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '25 GB',
        tierPrice: 63,
      },
      {
        billingInterval: ANNUAL,
        category: 'replays',
        max: '10M',
        min: '500',
        selectedTier: '25,000',
        tierPrice: 780,
      },
    ]);
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
    await userEvent.click(heading);

    // Click continue to collapse the panel again
    const button = within(panel).getByLabelText('Continue');
    await userEvent.click(button);

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

    assertSliders([
      {
        billingInterval: ANNUAL,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '200,000',
        tierPrice: 352,
      },
      {
        billingInterval: ANNUAL,
        category: 'transactions',
        max: '200M',
        min: '100K',
        selectedTier: '500,000',
        tierPrice: 324,
        hasDynamicSampling: true,
      },
      {
        billingInterval: ANNUAL,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '25 GB',
        tierPrice: 63,
      },
      {
        billingInterval: ANNUAL,
        category: 'replays',
        max: '10M',
        min: '500',
        selectedTier: '10,000',
        tierPrice: 312,
      },
    ]);
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

// TODO(isabella): temporarily skipping some tests here that rely on the new checkout steps to
// be added to checkout flow
describe('AddDataVolume for modern plans', function () {
  const api = new MockApiClient();
  const {organization, router, routerProps} = initializeOrg();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  const billingConfig = BillingConfigFixture(PlanTier.AM3);
  const bizPlan = PlanDetailsLookupFixture('am3_business')!;
  const teamPlanAnnual = PlanDetailsLookupFixture('am3_team_auf')!;

  const stepProps = {
    checkoutTier: PlanTier.AM3,
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
      body: BillingConfigFixture(PlanTier.AM3),
    });
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('renders a heading', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );

    const heading = await screen.findByText('Set Reserved Volumes (optional)');
    expect(heading).toBeInTheDocument();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('renders with default event volumes', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );

    // Open section by clicking on heading.
    const heading = await screen.findByText('Set Reserved Volumes (optional)');
    await userEvent.click(heading);

    assertSliders([
      {
        billingInterval: MONTHLY,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '50,000',
      },
      {
        billingInterval: MONTHLY,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '1 GB',
      },
      {
        billingInterval: MONTHLY,
        category: 'replays',
        max: '10M',
        min: '50',
        selectedTier: '50',
      },
      {
        billingInterval: MONTHLY,
        category: 'spans',
        max: '10B',
        min: '10M',
        selectedTier: '10,000,000',
      },
    ]);
  });

  it('renders additional event volume prices, business plan', function () {
    const props = {
      ...stepProps,
      formData: {
        plan: 'am3',
        reserved: {
          errors: 100_000,
          spans: 20_000_000,
          attachments: 50,
          replays: 10_000,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);
    assertSliders([
      {
        billingInterval: MONTHLY,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '100,000',
        tierPrice: 45,
        pricePerEvent: '$0.00089 per event',
      },
      {
        billingInterval: MONTHLY,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '50 GB',
        tierPrice: 12,
        pricePerEvent: '$0.25',
      },
      {
        billingInterval: MONTHLY,
        category: 'replays',
        max: '10M',
        min: '50',
        selectedTier: '10,000',
        tierPrice: 29,
        pricePerEvent: '$0.00285 per event',
      },
      {
        billingInterval: MONTHLY,
        category: 'spans',
        max: '10B',
        min: '10M',
        selectedTier: '20,000,000',
        tierPrice: 32,
        pricePerEvent: '$0.0000032 per unit',
      },
    ]);
  });

  it('renders event volume prices, team annual plan', function () {
    const props = {
      ...stepProps,
      activePlan: teamPlanAnnual,
      formData: {
        plan: 'am3',
        reserved: {
          errors: 300_000,
          spans: 20_000_000,
          attachments: 25,
          replays: 25_000,
          monitorSeats: 1,
        },
      },
    };
    render(<AddDataVolume {...props} />);

    assertSliders([
      {
        billingInterval: ANNUAL,
        category: 'errors',
        max: '50M',
        min: '50K',
        selectedTier: '300,000',
        tierPrice: 551,
      },
      {
        billingInterval: ANNUAL,
        category: 'attachments',
        max: '1GB',
        min: '1,000GB',
        selectedTier: '25 GB',
        tierPrice: 65,
      },
      {
        billingInterval: ANNUAL,
        category: 'replays',
        max: '10M',
        min: '50',
        selectedTier: '25,000',
        tierPrice: 778,
      },
      {
        billingInterval: ANNUAL,
        category: 'spans',
        max: '10B',
        min: '10M',
        selectedTier: '20,000,000',
        tierPrice: 173,
      },
    ]);
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('can complete step', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
        params={params}
      />,
      {
        router,
      }
    );
    const panel = await screen.findByTestId('step-add-data-volume');
    const heading = within(panel).getByText('Set Reserved Volumes (optional)');
    await userEvent.click(heading);

    // Click continue to collapse the panel again
    const button = within(panel).getByLabelText('Continue');
    await userEvent.click(button);

    // The button should be gone now.
    expect(within(panel).queryByLabelText('Continue')).not.toBeInTheDocument();
  });
});
