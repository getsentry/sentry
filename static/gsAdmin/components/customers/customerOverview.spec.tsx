import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import CustomerOverview from 'admin/components/customers/customerOverview';
import {AddOnCategory, PlanTier} from 'getsentry/types';

describe('CustomerOverview', () => {
  it('renders DetailLabels for SubscriptionSummary section', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});
    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Balance:')).toBeInTheDocument();
    expect(screen.getByText('Billing Period:')).toBeInTheDocument();
    expect(screen.getByText('Contract Period:')).toBeInTheDocument();
    expect(screen.getByText('On-Demand:')).toBeInTheDocument();
    expect(screen.getByText('Gifted Errors:')).toBeInTheDocument();
    expect(screen.getByText('Gifted Transactions:')).toBeInTheDocument();
    expect(screen.getByText('Can Trial:')).toBeInTheDocument();
    expect(screen.getByText('Legacy Soft Cap:')).toBeInTheDocument();
    expect(screen.getByText('Soft Cap By Category:')).toBeInTheDocument();
  });

  it('renders soft cap type details', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
    });
    subscription.categories.errors = MetricHistoryFixture({
      ...subscription.categories.errors,
      softCapType: 'ON_DEMAND',
    });
    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Errors: On Demand')).toBeInTheDocument();
    expect(screen.queryByText('Transactions: On Demand')).not.toBeInTheDocument();
    expect(screen.queryByText('Replays: On Demand')).not.toBeInTheDocument();
    expect(screen.queryByText('Attachments: On Demand')).not.toBeInTheDocument();
    expect(screen.queryByText('Cron Monitors: On Demand')).not.toBeInTheDocument();
  });

  it('renders soft cap type details all categories', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
    });
    subscription.categories.errors = MetricHistoryFixture({
      ...subscription.categories.errors,
      softCapType: 'TRUE_FORWARD',
    });
    subscription.categories.transactions = MetricHistoryFixture({
      ...subscription.categories.transactions,
      softCapType: 'TRUE_FORWARD',
    });
    subscription.categories.replays = MetricHistoryFixture({
      ...subscription.categories.replays,
      category: DataCategory.REPLAYS,
      softCapType: 'TRUE_FORWARD',
    });
    subscription.categories.attachments = MetricHistoryFixture({
      ...subscription.categories.attachments,
      softCapType: 'TRUE_FORWARD',
    });

    subscription.categories.monitorSeats = MetricHistoryFixture({
      ...subscription.categories.monitorSeats,
      softCapType: 'ON_DEMAND',
    });
    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Errors: True Forward')).toBeInTheDocument();
    expect(screen.getByText('Transactions: True Forward')).toBeInTheDocument();
    expect(screen.getByText('Replays: True Forward')).toBeInTheDocument();
    expect(screen.getByText('Attachments: True Forward')).toBeInTheDocument();
    expect(screen.getByText('Cron monitors: On Demand')).toBeInTheDocument();
  });

  it('renders manually invoiced on-demand details', () => {
    const organization = OrganizationFixture();
    const subscription = InvoicedSubscriptionFixture({
      organization,
      customPrice: 1_000_000_00,
      customPricePcss: 40_000_00,
      onDemandInvoicedManual: true,
      onDemandMaxSpend: 3_000_000_00,
      supportsOnDemand: true,
      categories: {
        errors: MetricHistoryFixture({
          customPrice: 300_000_00,
          paygCpe: 12.345678,
          order: 1,
        }),
        transactions: MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          customPrice: 400_000_00,
          paygCpe: 100,
          order: 2,
        }),
        replays: MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          customPrice: 100_000_00,
          paygCpe: 50,
          order: 4,
        }),
        monitorSeats: MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          customPrice: 10_000_00,
          paygCpe: 7.55,
          order: 7,
        }),
        attachments: MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          customPrice: 150_000_00,
          paygCpe: 20.3,
          order: 8,
        }),
      },
    });
    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    // invoiced balance
    expect(screen.getByText('$0.00 owed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Note: this is an invoiced account, please send any questions about this balance to'
      )
    ).toBeInTheDocument();

    // custom price information
    expect(screen.getByText('Custom Price Errors:')).toBeInTheDocument();
    expect(screen.getByText('$300,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price Performance units:')).toBeInTheDocument();
    expect(screen.getByText('$400,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price Replays:')).toBeInTheDocument();
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price Attachments:')).toBeInTheDocument();
    expect(screen.getByText('$150,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price Cron monitors:')).toBeInTheDocument();
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price PCSS:')).toBeInTheDocument();
    expect(screen.getByText('$40,000.00')).toBeInTheDocument();
    expect(screen.getByText('Custom Price (Total):')).toBeInTheDocument();
    expect(screen.getByText('$1,000,000.00')).toBeInTheDocument();

    // on-demand information
    expect(screen.getByText('Shared budget strategy')).toBeInTheDocument();
    expect(screen.getByText('Total: $0.00 / $3,000,000.00')).toBeInTheDocument();

    // CPE information
    expect(screen.getByText('On-Demand Cost-Per-Event Errors:')).toBeInTheDocument();
    expect(screen.getByText('$0.12345678')).toBeInTheDocument();
    expect(
      screen.getByText('On-Demand Cost-Per-Event Performance units:')
    ).toBeInTheDocument();
    expect(screen.getByText('$1.00000000')).toBeInTheDocument();
    expect(screen.getByText('On-Demand Cost-Per-Event Replays:')).toBeInTheDocument();
    expect(screen.getByText('$0.50000000')).toBeInTheDocument();
    expect(screen.getByText('On-Demand Cost-Per-Event Attachments:')).toBeInTheDocument();
    expect(screen.getByText('$0.20300000')).toBeInTheDocument();
    expect(
      screen.getByText('On-Demand Cost-Per-Event Cron monitors:')
    ).toBeInTheDocument();
    expect(screen.getByText('$0.07550000')).toBeInTheDocument();
  });

  it('renders partner details for active partner account', () => {
    const organization = OrganizationFixture();
    const partnerSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      partner: {
        externalId: '123',
        name: 'test',
        partnership: {
          id: 'XX',
          displayName: 'XX',
          supportNote: '',
        },
        isActive: true,
      },
      sponsoredType: 'XX',
    });

    render(
      <CustomerOverview
        customer={partnerSubscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('XX')).toBeInTheDocument();
    expect(screen.getByText('XX (active)')).toBeInTheDocument();
    expect(screen.getByText('ID: 123')).toBeInTheDocument();
    expect(screen.getByText('Deactivate Partner')).toBeInTheDocument();
  });

  it('render partner details for inactive partner account', () => {
    const organization = OrganizationFixture();
    const partnerSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      partner: {
        externalId: '123',
        name: 'test',
        partnership: {
          id: 'XX',
          displayName: 'XX',
          supportNote: '',
        },
        isActive: false,
      },
    });

    render(
      <CustomerOverview
        customer={partnerSubscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.queryByText('XX')).not.toBeInTheDocument();
    expect(screen.getByText('XX (migrated)')).toBeInTheDocument();
    expect(screen.getByText('ID: 123')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate Partner')).not.toBeInTheDocument();
  });

  it('deactivates partner account with right data', async () => {
    const organization = OrganizationFixture();
    const partnerSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      partner: {
        externalId: '123',
        name: 'test',
        partnership: {
          id: 'XX',
          displayName: 'XX',
          supportNote: '',
        },
        isActive: true,
      },
      sponsoredType: 'XX',
    });

    const mockOnAction = jest.fn();

    render(
      <CustomerOverview
        customer={partnerSubscription}
        onAction={mockOnAction}
        organization={organization}
      />
    );
    await userEvent.click(screen.getByText('Deactivate Partner'));

    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deactivatePartnerAccount: true,
      })
    );
  });

  it('renders reserved budget data', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionWithLegacySeerFixture({organization});
    subscription.reservedBudgets = [
      SeerReservedBudgetFixture({
        totalReservedSpend: 20_00,
        freeBudget: 15_00,
        percentUsed: 0.5,
      }),
    ];
    subscription.reservedBudgets[0]!.categories.seerAutofix!.reservedSpend = 18_00;
    subscription.reservedBudgets[0]!.categories.seerScanner!.reservedSpend = 2_00;

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Seer Budget')).toBeInTheDocument();
    expect(screen.getByText('Reserved Budget:')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Gifted Budget:')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('Total Used:')).toBeInTheDocument();
    expect(screen.getByText('$20.00 / $40.00 (50.00%)')).toBeInTheDocument();
    expect(screen.getByText('Reserved Issue fixes:')).toBeInTheDocument();
    expect(screen.getByText('Reserved Cost-Per-Event Issue fixes:')).toBeInTheDocument();
    expect(screen.getByText('$1.00000000')).toBeInTheDocument();
    expect(screen.getByText('Reserved Spend Issue fixes:')).toBeInTheDocument();
    expect(screen.getByText('$18.00')).toBeInTheDocument();
    expect(screen.getByText('Reserved Issue scans:')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(screen.getByText('Reserved Cost-Per-Event Issue scans:')).toBeInTheDocument();
    expect(screen.getByText('$0.01000000')).toBeInTheDocument();
    expect(screen.getByText('Reserved Spend Issue scans:')).toBeInTheDocument();
    expect(screen.getByText('$2.00')).toBeInTheDocument();

    expect(screen.queryByText('Reserved Cost-Per-Event Errors')).not.toBeInTheDocument();
  });

  it('renders no product trials for pre-performance account', () => {
    const organization = OrganizationFixture();
    const mm2_subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      planTier: PlanTier.MM2,
    });

    render(
      <CustomerOverview
        customer={mm2_subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.queryByText('Product Trials')).not.toBeInTheDocument();
    expect(screen.queryByText('Replays:')).not.toBeInTheDocument();
    expect(screen.queryByText('Spans:')).not.toBeInTheDocument();
    expect(screen.queryByText('Performance Units:')).not.toBeInTheDocument();
    expect(screen.queryByText('Transactions:')).not.toBeInTheDocument();
    expect(screen.queryByText('Seer:')).not.toBeInTheDocument();
  });

  it('renders product trials for non-self-serve account', () => {
    const organization = OrganizationFixture();
    const enterprise_subscription = InvoicedSubscriptionFixture({
      organization,
      plan: 'am3_business_ent_auf',
      planTier: PlanTier.AM3,
    });

    render(
      <CustomerOverview
        customer={enterprise_subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Product Trials')).toBeInTheDocument();
    expect(screen.getByText('Spans:')).toBeInTheDocument();
    expect(screen.getByText('Replays:')).toBeInTheDocument();
    expect(screen.getByText('Seer:')).toBeInTheDocument();
    expect(screen.queryByText('Performance Units:')).not.toBeInTheDocument();
    expect(screen.queryByText('Transactions:')).not.toBeInTheDocument();
  });

  it('renders product trials based on current subscription state', () => {
    const organization = OrganizationFixture();
    const am3Subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      productTrials: [
        {
          category: DataCategory.REPLAYS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().add(20, 'days').format(),
        },
        {
          category: DataCategory.SPANS,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(10, 'days').format(),
          endDate: moment().utc().subtract(1, 'hours').format(),
        },
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(20, 'days').format(),
          endDate: moment().utc().subtract(10, 'days').format(),
        },
        {
          category: DataCategory.SEER_SCANNER,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(20, 'days').format(),
          endDate: moment().utc().subtract(10, 'days').format(),
        },
      ],
    });
    am3Subscription.addOns!.seer = {
      ...am3Subscription.addOns!.seer!,
      isAvailable: false,
    };

    render(
      <CustomerOverview
        customer={am3Subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Product Trials')).toBeInTheDocument();

    // Find the DetailList containing product trials by finding the heading and its next sibling
    const productTrialsHeading = screen.getByRole('heading', {
      name: 'Product Trials',
    });
    const productTrialsList = productTrialsHeading.nextElementSibling;
    expect(productTrialsList).toBeInTheDocument();
    // Check if productTrialsList is an HTMLElement before using within
    if (!productTrialsList || !(productTrialsList instanceof HTMLElement)) {
      throw new Error('Product trials list not found or not an HTMLElement');
    }
    expect(productTrialsList.tagName).toBe('DL'); // Verify it's the correct element type

    const possibleTrialCategories = [
      DataCategory.TRANSACTIONS,
      DataCategory.REPLAYS,
      DataCategory.SPANS,
      DataCategory.PROFILE_DURATION,
      DataCategory.PROFILE_DURATION_UI,
      DataCategory.LOG_BYTE,
      AddOnCategory.LEGACY_SEER,
    ];

    const assertProductTrialActions = (
      category: DataCategory | AddOnCategory,
      formattedDisplayName: string,
      shouldNotIncludeTrialCategory = false
    ) => {
      if (possibleTrialCategories.includes(category) && !shouldNotIncludeTrialCategory) {
        const termElement = within(productTrialsList).getByText(
          `${formattedDisplayName}:`
        );
        const definition = termElement.nextElementSibling;
        expect(definition).toBeInTheDocument();
        if (!definition || !(definition instanceof HTMLElement)) {
          throw new Error(`${category} definition not found or not an HTMLElement`);
        }

        const allowTrialButton = within(definition).getByRole('button', {
          name: 'Allow Trial',
        });
        expect(allowTrialButton).toBeInTheDocument();
        const startTrialButton = within(definition).getByRole('button', {
          name: 'Start Trial',
        });
        expect(startTrialButton).toBeInTheDocument();
        const stopTrialButton = within(definition).getByRole('button', {
          name: 'Stop Trial',
        });
        expect(stopTrialButton).toBeInTheDocument();

        if (category === DataCategory.REPLAYS) {
          expect(allowTrialButton).toBeDisabled();
          expect(startTrialButton).toBeDisabled();
          expect(stopTrialButton).toBeEnabled();
          expect(within(definition).getByText('Active')).toBeInTheDocument();
        } else if (category === DataCategory.SPANS) {
          expect(allowTrialButton).toBeDisabled();
          expect(startTrialButton).toBeDisabled();
          expect(stopTrialButton).toBeDisabled();
          expect(within(definition).getByText(/Active \(/)).toBeInTheDocument();
        } else if (category === AddOnCategory.LEGACY_SEER) {
          expect(allowTrialButton).toBeEnabled();
          expect(startTrialButton).toBeDisabled();
          expect(stopTrialButton).toBeDisabled();
          expect(within(definition).getByText('Used')).toBeInTheDocument();
        } else {
          expect(allowTrialButton).toBeDisabled();
          expect(startTrialButton).toBeEnabled();
          expect(stopTrialButton).toBeDisabled();
          expect(within(definition).getByText('Available')).toBeInTheDocument();
        }
      } else {
        expect(
          within(productTrialsList).queryByText(`${formattedDisplayName}:`)
        ).not.toBeInTheDocument();
      }
    };

    am3Subscription.planDetails.categories.forEach(category => {
      const formattedDisplayName = toTitleCase(
        am3Subscription.planDetails.categoryDisplayNames?.[category]?.plural ?? category,
        {allowInnerUpperCase: true}
      );
      assertProductTrialActions(category, formattedDisplayName);
    });
    Object.values(am3Subscription.addOns || {}).forEach(addOn => {
      const formattedDisplayName =
        toTitleCase(addOn.productName, {
          allowInnerUpperCase: true,
        }) + (addOn.apiName === AddOnCategory.LEGACY_SEER ? ' (Legacy)' : '');
      assertProductTrialActions(addOn.apiName, formattedDisplayName);
    });

    possibleTrialCategories.forEach(category => {
      if (
        !am3Subscription.planDetails.categories.includes(category as DataCategory) &&
        !Object.keys(am3Subscription.planDetails.availableReservedBudgetTypes).includes(
          category
        )
      ) {
        assertProductTrialActions(
          category,
          toTitleCase(category, {allowInnerUpperCase: true}),
          true
        );
      }
    });
  });

  it('render dynamic sampling rate for am3 account', async () => {
    const organization = OrganizationFixture({
      features: ['dynamic-sampling'],
      desiredSampleRate: 0.75,
    });
    const am3Subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: PlanTier.AM3,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sampling/effective-sample-rate/`,
      body: {effectiveSampleRate: 0.75},
    });

    render(
      <CustomerOverview
        customer={am3Subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Team Plan (am3)')).toBeInTheDocument();
    await waitFor(() => {
      const term = screen.getByText('Sample Rate (24h):');
      const definition = term.nextElementSibling;
      expect(definition).toHaveTextContent('75.00%');
    });
  });

  it('renders effective sample rate with desired comparison string', async () => {
    const organization = OrganizationFixture({
      features: ['dynamic-sampling'],
      desiredSampleRate: 0.6,
    });
    const subscription = SubscriptionFixture({
      organization,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sampling/effective-sample-rate/`,
      body: {effectiveSampleRate: 0.54},
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );
    await screen.findByText('54.00% instead of 60.00% (~6.00%)');
  });

  it('renders n/a when effective sample rate is missing', async () => {
    const organization = OrganizationFixture({
      features: ['dynamic-sampling'],
      desiredSampleRate: 0.75,
    });
    const subscription = SubscriptionFixture({
      organization,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sampling/effective-sample-rate/`,
      body: {effectiveSampleRate: null},
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    await waitFor(() => {
      const term = screen.getByText('Sample Rate (24h):');
      expect(term.nextElementSibling).toHaveTextContent('n/a');
    });
  });

  it('renders retention settings', () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });

    subscription.planDetails = {
      ...subscription.planDetails,
      retentions: {
        [DataCategory.SPANS]: {standard: 1234567, downsampled: 7654321},
        [DataCategory.LOG_BYTE]: {standard: 1470369, downsampled: 9630741},
        [DataCategory.ERRORS]: {standard: 2581471, downsampled: 1741852},
      },
    };

    subscription.categories.spans = MetricHistoryFixture({
      ...subscription.categories.spans,
      category: DataCategory.SPANS,
      retention: {standard: 13579, downsampled: 24680},
    });

    subscription.categories.logBytes = MetricHistoryFixture({
      ...subscription.categories.logBytes,
      category: DataCategory.LOG_BYTE,
      retention: {standard: 97531, downsampled: null},
    });

    subscription.categories.errors = MetricHistoryFixture({
      ...subscription.categories.errors,
      category: DataCategory.ERRORS,
      retention: {standard: 36925, downsampled: 52963},
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('Retention Settings')).toBeInTheDocument();

    // planDetails downsampled for span and logs in document, but not for errors
    expect(screen.getByText('7654321')).toBeInTheDocument();
    expect(screen.getByText('9630741')).toBeInTheDocument();
    expect(screen.queryByText('1741852')).not.toBeInTheDocument();

    // categories downsampled for span and logs in document, but not for errors
    expect(screen.getByText('13579')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.queryByText('36925')).not.toBeInTheDocument();
  });

  it('renders org retention', () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      orgRetention: {standard: 1234567, downsampled: null},
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('1234567 days')).toBeInTheDocument();
  });

  it('renders errors retention default', () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      orgRetention: {standard: null, downsampled: null},
      categories: {
        errors: MetricHistoryFixture({
          retention: {standard: 987, downsampled: null},
        }),
      },
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('987 days')).toBeInTheDocument();
  });

  it('renders org retention default', () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      orgRetention: {standard: null, downsampled: null},
    });

    render(
      <CustomerOverview
        customer={subscription}
        onAction={jest.fn()}
        organization={organization}
      />
    );

    expect(screen.getByText('90 days')).toBeInTheDocument();
  });
});
