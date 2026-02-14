import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MONTHLY} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier, type Subscription} from 'getsentry/types';
import ReserveAdditionalVolume from 'getsentry/views/amCheckout/steps/reserveAdditionalVolume';

type SliderInfo = {
  billingInterval: string;
  category: string;
  max: string;
  min: string;
  selectedTier: string;
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
}: SliderInfo) {
  const slider = screen.getByTestId(`${category}-volume-item`).textContent;
  expect(slider).toContain(selectedTier);
  expect(slider).toContain(`${min} included`);
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
}

function assertSliders(sliderInfo: SliderInfo[]) {
  sliderInfo.forEach(info => assertSlider(info));
  expect(screen.getAllByRole('slider')).toHaveLength(sliderInfo.length);
}

async function openSection() {
  await userEvent.click(
    screen.getByRole('button', {name: /Show reserved volume sliders/})
  );
}

async function closeSection() {
  await userEvent.click(
    screen.getByRole('button', {name: /Hide reserved volume sliders/})
  );
}

describe('ReserveAdditionalVolume', () => {
  describe('Legacy Plans', () => {
    const {organization} = initializeOrg();
    const subscription = SubscriptionFixture({
      organization,
    });

    const billingConfig = BillingConfigFixture(PlanTier.AM2);
    billingConfig.planList = billingConfig.planList.filter(plan => plan.userSelectable);
    const am2BizPlanMonthly = PlanDetailsLookupFixture('am2_business')!;
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
      activePlan: am2BizPlanMonthly,
      isCompleted: false,
      organization,
      prevStepCompleted: true,
    };

    beforeEach(() => {
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

    it('renders with event volumes and pricing warning', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/promotions/trigger-check/`,
        method: 'POST',
      });
      render(<ReserveAdditionalVolume {...stepProps} />);

      expect(await screen.findByText(/Reserve additional volume/)).toBeInTheDocument();
      await openSection();
      assertSliders([
        {
          billingInterval: MONTHLY,
          category: 'errors',
          max: '50M',
          min: '50,000',
          selectedTier: '50,000',
        },
        {
          billingInterval: MONTHLY,
          category: 'transactions',
          max: '200M',
          min: '100,000',
          selectedTier: '100,000',
        },
        {
          billingInterval: MONTHLY,
          category: 'attachments',
          max: '1,000 GB',
          min: '1 GB',
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

    it('displays performance unit types with feature', async () => {
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
      render(<ReserveAdditionalVolume {...props} />);
      await openSection();

      const transactions = screen.getByTestId('transactions-volume-item').textContent;
      expect(transactions).toContain('Sentry Performance');
    });

    it('does not display performance unit types without feature', async () => {
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
      render(<ReserveAdditionalVolume {...props} />);
      await openSection();

      const transactions = screen.getByTestId('transactions-volume-item').textContent;
      expect(transactions).not.toContain('Sentry Performance');
    });
  });

  describe('Modern Plans', () => {
    const {organization} = initializeOrg();
    let subscription: Subscription;

    const billingConfig = BillingConfigFixture(PlanTier.AM3);
    const bizPlanMonthly = PlanDetailsLookupFixture('am3_business')!;

    const stepProps: any = {
      checkoutTier: PlanTier.AM3,
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
      activePlan: bizPlanMonthly,
      isCompleted: false,
      organization,
      prevStepCompleted: true,
    };

    beforeEach(() => {
      subscription = SubscriptionFixture({organization});
      stepProps.subscription = subscription;
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

    it('renders with event volumes and pricing warning', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/promotions/trigger-check/`,
        method: 'POST',
      });
      render(<ReserveAdditionalVolume {...stepProps} />);

      expect(await screen.findByText(/Reserve additional volume/)).toBeInTheDocument();
      await openSection();
      assertSliders([
        {
          billingInterval: MONTHLY,
          category: 'errors',
          max: '50M',
          min: '50,000',
          selectedTier: '50,000',
        },
        {
          billingInterval: MONTHLY,
          category: 'attachments',
          max: '1,000 GB',
          min: '1 GB',
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
          min: '10,000,000',
          selectedTier: '10,000,000',
        },
      ]);
    });

    it('can hide sliders', async () => {
      render(<ReserveAdditionalVolume {...stepProps} />);
      await openSection();
      expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();
      await closeSection();
      expect(screen.queryByTestId('errors-volume-item')).not.toBeInTheDocument();
    });

    it('auto-shows sliders if customer has reserved volume above platform', () => {
      const paidSub = SubscriptionFixture({organization, plan: 'am3_business'});
      paidSub.categories.errors!.reserved = 100_000;
      render(<ReserveAdditionalVolume {...stepProps} subscription={paidSub} />);
      expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();
    });

    it('does not auto-show sliders if customer is on a trial subscription', () => {
      const trialSub = SubscriptionFixture({
        organization,
        plan: 'am3_t',
        planTier: PlanTier.AM3,
        isTrial: true, // This is true for both subscription trials and plan trials
        categories: {
          // These are high trial volumes that should NOT be used in checkout
          errors: MetricHistoryFixture({reserved: 750_000}), // High trial volume
          attachments: MetricHistoryFixture({reserved: 200}), // High trial volume
          replays: MetricHistoryFixture({reserved: 50_000}), // High trial volume
          spans: MetricHistoryFixture({reserved: 100_000_000}), // High trial volume
          monitorSeats: MetricHistoryFixture({reserved: 20}),
          profileDuration: MetricHistoryFixture({reserved: 20}),
        },
        isFree: false,
      });
      render(<ReserveAdditionalVolume {...stepProps} subscription={trialSub} />);
      expect(screen.queryByTestId('errors-volume-item')).not.toBeInTheDocument();
    });
  });
});
