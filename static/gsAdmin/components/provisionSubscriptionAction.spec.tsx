import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {DataCategory} from 'sentry/types/core';

import triggerProvisionSubscription from 'admin/components/provisionSubscriptionAction';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';

describe('provisionSubscriptionAction', function () {
  const onSuccess = jest.fn();
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg});
  const mockBillingConfig = BillingConfigFixture(PlanTier.ALL);

  function getSpinbutton(name: string) {
    return screen.getByRole('spinbutton', {name});
  }

  function getAllSpinbuttons(startsWith: string) {
    return screen.getAllByRole('spinbutton', {name: new RegExp(startsWith)});
  }

  async function clickCheckbox(name: string | RegExp) {
    await userEvent.click(await screen.findByRole('checkbox', {name}), {
      delay: null,
      skipHover: true,
    });
  }

  async function typeNum(field: HTMLElement, value: string, clearField: boolean) {
    if (clearField) {
      await userEvent.clear(field);
    }
    await userEvent.click(field, {delay: null, skipHover: true});
    await userEvent.paste(value, {delay: null, skipHover: true});
  }

  async function typeNumForMatchingFields(
    startsWith: string,
    value: string,
    clearField = true
  ) {
    const matchingFields = getAllSpinbuttons(startsWith);
    for (const field of matchingFields) {
      await typeNum(field, value, clearField);
    }
  }

  async function typeNumForField(name: string, value: string, clearField = true) {
    const field = getSpinbutton(name);
    await typeNum(field, value, clearField);
  }

  async function loadModal() {
    const modal = renderGlobalModal();
    expect(await screen.findByText('Provision Subscription Changes')).toBeInTheDocument();
    return modal;
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders modal with form', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    // does not render category-specific fields when no plan is selected
    expect(screen.getAllByText(/Reserved/)).toHaveLength(1); // only for reserved volume price header
    expect(screen.queryByText(/Soft Cap Type/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Price for/)).toHaveLength(1); // only for PCSS
    expect(getSpinbutton('Price for PCSS')).toBeInTheDocument();
    expect(getSpinbutton('Annual Contract Value')).toBeInTheDocument();

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Plan'}));

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );

    // renders category-specific fields when a plan is selected
    expect(screen.getAllByText(/Reserved/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Soft Cap Type/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Price for/).length).toBeGreaterThan(1);

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Billing Interval'}));

    ['Annual', 'Monthly'].forEach(plan =>
      expect(screen.getByRole('menuitemradio', {name: plan})).toBeInTheDocument()
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Billing Type'}));

    ['Invoiced', 'Credit Card'].forEach(plan =>
      expect(screen.getByRole('menuitemradio', {name: plan})).toBeInTheDocument()
    );

    await selectEvent.openMenu(
      screen.getByRole('textbox', {name: 'Soft Cap Type Errors'})
    );
    ['On Demand', 'True Forward'].forEach(softCapType =>
      expect(screen.getByRole('menuitemradio', {name: softCapType})).toBeInTheDocument()
    );

    expect(screen.getByLabelText('Start Date')).toBeRequired();

    expect(
      screen.getByRole('checkbox', {
        name: /Apply Changes at the End of the Current Billing Period/,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('checkbox', {name: 'Apply Changes To Current Subscription'})
    ).toBeInTheDocument();
  });

  it('shows SKUs based on plan chosen', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am2)'
    );

    expect(screen.getByLabelText('Reserved Performance Units')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reserved Spans')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeInTheDocument();
    expect(screen.queryByLabelText('Soft Cap Type Spans')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Price for Performance Units')).toBeInTheDocument();
    expect(screen.queryByLabelText('Price for Spans')).not.toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );

    // enable span fields, disable performance unit fields
    expect(screen.queryByLabelText('Reserved Performance Units')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reserved Spans')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Soft Cap Type Performance Units')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Soft Cap Type Spans')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Price for Performance Units')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Price for Spans')).toBeInTheDocument();
  });

  it('select coterm disables effectiveAt and atPeriodEnd', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();
    await clickCheckbox('Apply Changes To Current Subscription');

    expect(screen.getByLabelText('Start Date')).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: /Apply Changes at the End of the Current Billing/,
      })
    ).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Billing Interval'})).toBeDisabled();
  });

  it('select atPeriodEnd disables coterm and effectiveAt', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();
    await clickCheckbox(/Apply Changes at the End of the Current Billing/);

    expect(screen.getByLabelText('Start Date')).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Apply Changes To Current Subscription'})
    ).toBeDisabled();
  });

  it('hides manually invoiced on-demand fields when credit card type is selected', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    const modal = await loadModal();
    const container = modal.baseElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Credit Card'
    );

    expect(
      within(container).queryByLabelText('On-Demand Max Spend Setting')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Errors')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Performance Units')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Replays')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Attachments')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Cron Monitors')
    ).not.toBeInTheDocument();
  });

  it('shows manually invoiced on-demand type field when invoiced type is selected', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    const modal = await loadModal();
    const container = modal.baseElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    expect(
      within(container).getByLabelText('On-Demand Max Spend Setting')
    ).toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Errors')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Performance Units')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Replays')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Attachments')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Event Cron Monitors')
    ).not.toBeInTheDocument();
  });

  it('shows or hides on-demand CPE fields based on setting', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    const modal = await loadModal();
    const container = modal.baseElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    expect(
      within(container).queryByLabelText(/On-Demand Cost-Per-Event/)
    ).not.toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Shared'
    );
    expect(
      (await within(container).findAllByLabelText(/On-Demand Cost-Per-Event/)).length
    ).toBeGreaterThan(0);

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Disable'
    );
    expect(
      within(container).queryByLabelText(/On-Demand Cost-Per-Event/)
    ).not.toBeInTheDocument();
  });

  it('disables soft cap fields when enabling on-demand', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );
    const enabledSoftCapFields = screen.getAllByLabelText(/Soft Cap Type/);
    expect(enabledSoftCapFields.length).toBeGreaterThan(0);
    enabledSoftCapFields.forEach(field => expect(field).toBeEnabled());

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Shared'
    );
    const disabledSoftCapFields = screen.getAllByLabelText(/Soft Cap Type/);
    expect(disabledSoftCapFields.length).toBeGreaterThan(0);
    disabledSoftCapFields.forEach(field => expect(field).toBeDisabled());
  });

  it('does not disable soft cap fields when on-demand is disabled', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Disable'
    );
    const enabledSoftCapFields = screen.getAllByLabelText(/Soft Cap Type/);
    expect(enabledSoftCapFields.length).toBeGreaterThan(0);
    enabledSoftCapFields.forEach(field => expect(field).toBeEnabled());
  });

  it('renders spans fields based on selected plan', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    const modal = await loadModal();
    const container = modal.baseElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );

    expect(within(container).queryByText(/accepted spans/i)).not.toBeInTheDocument();
    expect(within(container).queryByText(/stored spans/i)).not.toBeInTheDocument();
    expect(within(container).queryByText(/reserved cost-per-/i)).not.toBeInTheDocument();
    expect(
      within(container).queryByText(/reserved spans budget/i)
    ).not.toBeInTheDocument();
    expect(within(container).getByLabelText('Reserved Spans')).toBeInTheDocument();
    expect(within(container).getByLabelText('Soft Cap Type Spans')).toBeInTheDocument();
    expect(within(container).getByLabelText('Price for Spans')).toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) with Dynamic Sampling (am3)'
    );

    expect(
      within(container).getByLabelText('Reserved Accepted Spans')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Soft Cap Type Accepted Spans')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Price for Accepted Spans')
    ).toBeInTheDocument();
    expect(
      within(container).queryByText('Reserved Spans Budget')
    ).not.toBeInTheDocument();
    expect(within(container).getByLabelText('Reserved Stored Spans')).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Soft Cap Type Stored Spans')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Price for Stored Spans')
    ).toBeInTheDocument();

    await typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    await typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');
    expect(
      within(container).getByLabelText('Price for Accepted Spans (Reserved Spans Budget)')
    ).toBeInTheDocument();
    expect(within(container).getByLabelText('Price for Stored Spans')).toHaveValue(0);
    expect(within(container).getByLabelText('Price for Stored Spans')).toBeDisabled();
  });

  it('reserved CPE fields are cleared when non-DS plan is selected', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) with Dynamic Sampling (am3)'
    );
    expect(screen.getByLabelText('Reserved Cost-Per-Event Accepted Spans')).toBeEnabled();
    expect(screen.getByLabelText('Reserved Cost-Per-Event Stored Spans')).toBeEnabled();

    await typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    await typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');

    expect(screen.getByLabelText('Reserved Accepted Spans')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Accepted Spans')).toHaveValue(-2);
    expect(screen.getByLabelText('Reserved Stored Spans')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Stored Spans')).toHaveValue(-2);

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );
    expect(
      screen.queryByLabelText('Reserved Cost-Per-Event Accepted Spans')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Reserved Cost-Per-Event Stored Spans')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reserved Spans')).toBeEnabled();
    expect(screen.queryByLabelText('Reserved Accepted Spans')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reserved Stored Spans')).not.toBeInTheDocument();
  });

  it('prefills the form based on the enterprise subscription', async function () {
    const mockInvoicedSub = InvoicedSubscriptionFixture({
      organization: mockOrg,
      plan: 'am3_business_ent_auf',
      customPrice: 60_000_00,
      customPricePcss: 40_000_00,
      onDemandInvoicedManual: true,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
        sharedMaxBudget: 1000,
      },
      supportsOnDemand: true,
      categories: {
        errors: MetricHistoryFixture({
          reserved: 100_000,
          paygCpe: 84,
          customPrice: 20_000_00,
        }),
        replays: MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          reserved: 500_000,
        }),
      },
    });
    triggerProvisionSubscription({
      subscription: mockInvoicedSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    expect(await screen.findByText('Enterprise (Business) (am3)')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
    expect(screen.getByText('Invoiced')).toBeInTheDocument();
    expect(screen.getByText('Shared')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('40000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.84')).toBeInTheDocument();
  });

  it('select am enterprise enables custom prices', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    expect(getSpinbutton('Annual Contract Value')).toBeDisabled();
    const priceForFields = screen.getAllByLabelText(/Price for/);
    expect(priceForFields).toHaveLength(1); // PCSS
    expect(getSpinbutton('Price for PCSS')).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    expect(getSpinbutton('Annual Contract Value')).toBeEnabled();
    const loadedPriceForFields = screen.getAllByLabelText(/Price for/);
    expect(loadedPriceForFields.length).toBeGreaterThan(1);
    expect(getSpinbutton('Price for PCSS')).toBeEnabled();
  });

  it('calls api with correct am1 args', async () => {
    const am1Sub = SubscriptionFixture({
      organization: mockOrg,
      plan: 'am1_f',
    });
    triggerProvisionSubscription({
      subscription: am1Sub,
      orgId: am1Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Errors'}),
      'On Demand'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Replays'}),
      'True Forward'
    );
    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForField('Reserved Transactions', '200000');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Price for Errors', '3000');
    await typeNumForField('Price for Transactions', '1000');
    await typeNumForField('Annual Contract Value', '4000');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          coterm: true,
          customPrice: 4000_00,
          customPriceAttachments: 0,
          customPriceErrors: 3000_00,
          customPricePcss: 0,
          customPriceTransactions: 1000_00,
          customPriceMonitorSeats: 0,
          customPriceUptime: 0,
          customPriceReplays: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am1_business_ent',
          reservedAttachments: 1,
          reservedErrors: 5000,
          reservedTransactions: 200_000,
          reservedMonitorSeats: 1,
          reservedUptime: 1,
          reservedReplays: 50,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: 'ON_DEMAND',
          softCapTypeTransactions: null,
          softCapTypeReplays: 'TRUE_FORWARD',
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeAttachments: null,
          trueForward: {
            errors: false,
            transactions: false,
            replays: true,
            monitorSeats: false,
            uptime: false,
            attachments: false,
          },
        },
      })
    );
  });

  it('retains on-demand budget when toggled', async () => {
    const am2Sub = SubscriptionFixture({
      organization: mockOrg,
      plan: 'am2_f',
      customPrice: 60_000_00,
      customPricePcss: 40_000_00,
      onDemandInvoicedManual: true,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
        sharedMaxBudget: 1000,
      },
    });
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am2)'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Shared'
    );
    await clickCheckbox('Retain On-Demand Budget');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(await screen.findByLabelText('Start Date'), '2020-10-25');
    await typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.1');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Annual Contract Value', '0');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${mockOrg.slug}/provision-subscription/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            billingInterval: 'annual',
            coterm: true,
            customPrice: 0,
            customPriceAttachments: 0,
            customPriceErrors: 0,
            customPriceMonitorSeats: 0,
            customPriceUptime: 0,
            customPricePcss: 0,
            customPriceReplays: 0,
            customPriceTransactions: 0,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            managed: true,
            onDemandInvoicedManual: 'SHARED',
            plan: 'am2_business_ent',
            paygCpeErrors: 10000000,
            paygCpeMonitorSeats: 10000000,
            paygCpeReplays: 10000000,
            paygCpeTransactions: 10000000,
            paygCpeUptime: 10000000,
            paygCpeProfileDuration: 10000000,
            paygCpeProfileDurationUI: 10000000,
            paygCpeAttachments: 10000000,
            reservedAttachments: 1,
            reservedErrors: 5000,
            reservedMonitorSeats: 1,
            reservedUptime: 1,
            reservedReplays: 50,
            reservedTransactions: 10000,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            retainOnDemandBudget: true,
            softCapTypeAttachments: null,
            softCapTypeErrors: null,
            softCapTypeMonitorSeats: null,
            softCapTypeUptime: null,
            softCapTypeReplays: null,
            softCapTypeTransactions: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            trueForward: {
              attachments: false,
              errors: false,
              monitorSeats: false,
              uptime: false,
              replays: false,
              transactions: false,
              profileDuration: false,
              profileDurationUI: false,
            },
            type: 'invoiced',
          },
        })
      );
    });
  }, 15_000);

  it('removes retain on-demand budget toggle when plan changes', async () => {
    const am2Sub = SubscriptionFixture({
      organization: mockOrg,
      plan: 'am2_f',
      customPrice: 60_000_00,
      customPricePcss: 40_000_00,
      onDemandInvoicedManual: true,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
        sharedMaxBudget: 1000,
      },
    });
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    const modal = await loadModal();
    const container = modal.baseElement;

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Shared'
    );

    expect(
      within(container).getByLabelText('Retain On-Demand Budget')
    ).toBeInTheDocument();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Per Category'
    );

    expect(
      within(container).queryByLabelText('Retain On-Demand Budget')
    ).not.toBeInTheDocument();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am2)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(await screen.findByLabelText('Start Date'), '2020-10-25');
    await typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.1');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Annual Contract Value', '0');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          coterm: true,
          customPrice: 0,
          customPriceAttachments: 0,
          customPriceErrors: 0,
          customPriceMonitorSeats: 0,
          customPriceUptime: 0,
          customPricePcss: 0,
          customPriceReplays: 0,
          customPriceTransactions: 0,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          managed: true,
          onDemandInvoicedManual: 'PER_CATEGORY',
          plan: 'am2_business_ent',
          paygCpeErrors: 10000000,
          paygCpeMonitorSeats: 10000000,
          paygCpeReplays: 10000000,
          paygCpeTransactions: 10000000,
          paygCpeUptime: 10000000,
          paygCpeProfileDuration: 10000000,
          paygCpeProfileDurationUI: 10000000,
          paygCpeAttachments: 10000000,
          reservedAttachments: 1,
          reservedErrors: 5000,
          reservedMonitorSeats: 1,
          reservedUptime: 1,
          reservedReplays: 50,
          reservedTransactions: 10000,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeReplays: null,
          softCapTypeTransactions: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            uptime: false,
            replays: false,
            transactions: false,
            profileDuration: false,
            profileDurationUI: false,
          },
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

  it('calls api with correct am2 args', async () => {
    const am2Sub = SubscriptionFixture({organization: mockOrg, plan: 'am2_f'});
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am2)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Errors'}),
      'True Forward'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Replays'}),
      'On Demand'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Cron Monitors'}),
      'On Demand'
    );
    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Uptime Monitors'}),
      'True Forward'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForField('Reserved Performance Units', '600000');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Price for Errors', '3000');
    await typeNumForField('Price for Uptime Monitors', '1000');
    await typeNumForField('Annual Contract Value', '4000');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          coterm: true,
          customPrice: 4000_00,
          customPriceAttachments: 0,
          customPriceErrors: 3000_00,
          customPricePcss: 0,
          customPriceReplays: 0,
          customPriceMonitorSeats: 0,
          customPriceUptime: 1000_00,
          customPriceTransactions: 0,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am2_business_ent',
          reservedAttachments: 1,
          reservedErrors: 5000,
          reservedReplays: 50,
          reservedMonitorSeats: 1,
          reservedUptime: 1,
          reservedTransactions: 600_000,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: 'TRUE_FORWARD',
          softCapTypeTransactions: null,
          softCapTypeReplays: 'ON_DEMAND',
          softCapTypeMonitorSeats: 'ON_DEMAND',
          softCapTypeUptime: 'TRUE_FORWARD',
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          trueForward: {
            errors: true,
            transactions: false,
            replays: false,
            monitorSeats: false,
            uptime: true,
            attachments: false,
            profileDuration: false,
            profileDurationUI: false,
          },
        },
      })
    );
  }, 15_000);

  it('calls api with correct am3 args', async () => {
    const am3Sub = SubscriptionFixture({organization: mockOrg, plan: 'am3_f'});
    triggerProvisionSubscription({
      subscription: am3Sub,
      orgId: am3Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am3)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Errors'}),
      'On Demand'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Replays'}),
      'True Forward'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Spans'}),
      'On Demand'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Uptime Monitors'}),
      'True Forward'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForField('Reserved Errors', '500000');
    await typeNumForField('Reserved Attachments (in GB)', '10');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Price for Spans', '2000');
    await typeNumForField('Price for Replays', '4000');
    await typeNumForField('Annual Contract Value', '6000');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${mockOrg.slug}/provision-subscription/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            billingInterval: 'annual',
            coterm: true,
            customPrice: 6000_00,
            customPriceAttachments: 0,
            customPriceErrors: 0,
            customPricePcss: 0,
            customPriceReplays: 4000_00,
            customPriceMonitorSeats: 0,
            customPriceUptime: 0,
            customPriceSpans: 2000_00,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            managed: true,
            onDemandInvoicedManual: 'DISABLE',
            plan: 'am3_business_ent',
            reservedAttachments: 10,
            reservedErrors: 500_000,
            reservedReplays: 50,
            reservedMonitorSeats: 1,
            reservedUptime: 1,
            reservedSpans: 10_000_000,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            retainOnDemandBudget: false,
            type: 'invoiced',
            softCapTypeErrors: 'ON_DEMAND',
            softCapTypeSpans: 'ON_DEMAND',
            softCapTypeReplays: 'TRUE_FORWARD',
            softCapTypeMonitorSeats: null,
            softCapTypeUptime: 'TRUE_FORWARD',
            softCapTypeAttachments: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            trueForward: {
              errors: false,
              spans: false,
              replays: true,
              monitorSeats: false,
              uptime: true,
              attachments: false,
              profileDuration: false,
              profileDurationUI: false,
            },
          },
        })
      );
    });
  }, 15_000);

  it('calls api with correct am3 dynamic sampling args', async () => {
    const am3Sub = SubscriptionFixture({organization: mockOrg, plan: 'am3_f'});
    triggerProvisionSubscription({
      subscription: am3Sub,
      orgId: am3Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) with Dynamic Sampling (am3)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Disable'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Accepted Spans'}),
      'True Forward'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForField('Reserved Replays', '75000');
    await typeNumForField('Reserved Uptime Monitors', '250');
    await typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    await typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Price for Accepted Spans (Reserved Spans Budget)', '12000'); // custom price for stored spans is auto-filled to 0
    await typeNumForField('Price for PCSS', '500');
    await typeNumForField('Annual Contract Value', '12500');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          coterm: true,
          customPrice: 12500_00,
          customPriceAttachments: 0,
          customPriceErrors: 0,
          customPricePcss: 500_00,
          customPriceReplays: 0,
          customPriceMonitorSeats: 0,
          customPriceUptime: 0,
          customPriceSpans: 12000_00,
          customPriceSpansIndexed: 0,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent_ds',
          reservedAttachments: 1,
          reservedErrors: 50_000,
          reservedReplays: 75_000,
          reservedMonitorSeats: 1,
          reservedUptime: 250,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedSpans: RESERVED_BUDGET_QUOTA,
          reservedSpansIndexed: RESERVED_BUDGET_QUOTA,
          reservedCpeSpans: 100_000_000,
          reservedCpeSpansIndexed: 200_000_000,
          reservedBudgets: [
            {
              categories: ['spans', 'spansIndexed'],
              budget: 12000_00,
            },
          ],
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: null,
          softCapTypeSpans: 'TRUE_FORWARD',
          softCapTypeSpansIndexed: null,
          softCapTypeReplays: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          trueForward: {
            errors: false,
            spans: true,
            spansIndexed: false,
            replays: false,
            monitorSeats: false,
            uptime: false,
            attachments: false,
            profileDuration: false,
            profileDurationUI: false,
          },
        },
      })
    );
  }, 15_000);

  it('calls api with correct manually invoiced on-demand args', async () => {
    const am2Sub = SubscriptionFixture({organization: mockOrg, plan: 'am2_f'});
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am2)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'On-Demand Max Spend Setting'}),
      'Shared'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForMatchingFields('Price for', '0', false);
    await typeNumForField('Annual Contract Value', '0');
    await typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.0001', false);
    await typeNumForField('On-Demand Cost-Per-Event Errors', '0.5');
    await typeNumForField('On-Demand Cost-Per-Event Performance Units', '0.0111');
    await typeNumForField('On-Demand Cost-Per-Event Replays', '1');
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${mockOrg.slug}/provision-subscription/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            billingInterval: 'annual',
            coterm: true,
            customPrice: 0,
            customPriceAttachments: 0,
            customPriceErrors: 0,
            customPricePcss: 0,
            customPriceReplays: 0,
            customPriceMonitorSeats: 0,
            customPriceUptime: 0,
            customPriceTransactions: 0,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            managed: true,
            paygCpeErrors: 50000000,
            paygCpeTransactions: 1110000,
            paygCpeReplays: 100000000,
            paygCpeAttachments: 10000,
            paygCpeProfileDuration: 10000,
            paygCpeProfileDurationUI: 10000,
            paygCpeMonitorSeats: 10000,
            paygCpeUptime: 10000,
            onDemandInvoicedManual: 'SHARED',
            plan: 'am2_business_ent',
            reservedAttachments: 1,
            reservedErrors: 5000,
            reservedReplays: 50,
            reservedMonitorSeats: 1,
            reservedUptime: 1,
            reservedTransactions: 10_000,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            retainOnDemandBudget: false,
            type: 'invoiced',
            softCapTypeErrors: null,
            softCapTypeTransactions: null,
            softCapTypeReplays: null,
            softCapTypeMonitorSeats: null,
            softCapTypeUptime: null,
            softCapTypeAttachments: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            trueForward: {
              errors: false,
              transactions: false,
              profileDuration: false,
              profileDurationUI: false,
              replays: false,
              monitorSeats: false,
              uptime: false,
              attachments: false,
            },
          },
        })
      );
    });
  }, 15_000);

  it('calls api with correct mm2 args', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Business (mm2)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNumForField('Reserved Errors', '2000000');
    await typeNumForField('Annual Contract Value', '4550');

    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      body: {},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          customPrice: 455000,
          coterm: true,
          managed: true,
          plan: 'mm2_a',
          reservedErrors: 2000000,
          retainOnDemandBudget: false,
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

  it('returns submit error on incorrect custom price', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNumForField('Reserved Errors', '2000000');
    await typeNumForField('Reserved Transactions', '1000000');
    await typeNumForField('Reserved Cron Monitors', '250');
    await typeNumForField('Reserved Uptime Monitors', '250');
    await typeNumForField('Reserved Replays', '500');
    await typeNumForField('Reserved Attachments (in GB)', '50');
    await typeNumForField('Price for Errors', '3000');
    await typeNumForField('Price for Replays', '0');
    await typeNumForField('Price for Cron Monitors', '400');
    await typeNumForField('Price for Uptime Monitors', '0');
    await typeNumForField('Price for Transactions', '1000');
    await typeNumForField('Price for Attachments', '50');
    await typeNumForField('Price for PCSS', '500');
    await typeNumForField('Annual Contract Value', '5050');

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(
      screen.getByText('Custom Price must be equal to sum of SKU prices')
    ).toBeInTheDocument();
  }, 15_000);

  it('returns api error', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await userEvent.type(await screen.findByLabelText('Start Date'), '2020-10-25');
    await typeNumForField('Reserved Errors', '2000000');
    await typeNumForField('Reserved Transactions', '1000000');
    await typeNumForField('Reserved Replays', '500');
    await typeNumForField('Reserved Cron Monitors', '250');
    await typeNumForField('Reserved Uptime Monitors', '250');
    await typeNumForField('Reserved Attachments (in GB)', '50');
    await typeNumForField('Price for Errors', '3000');
    await typeNumForField('Price for Transactions', '1000');
    await typeNumForField('Price for Replays', '0');
    await typeNumForField('Price for Cron Monitors', '400');
    await typeNumForField('Price for Uptime Monitors', '0');
    await typeNumForField('Price for Attachments', '50');
    await typeNumForField('Price for PCSS', '500');
    await typeNumForField('Annual Contract Value', '4950');

    MockApiClient.clearMockResponses();
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      statusCode: 500,
      body: {
        error: 'Internal error.',
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    expect(updateMock).toHaveBeenCalled();

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${mockOrg.slug}/provision-subscription/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          billingInterval: 'annual',
          customPrice: 495000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceTransactions: 100000,
          customPriceReplays: 0,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          effectiveAt: '2020-10-25',
          managed: true,
          plan: 'am1_business_ent',
          reservedAttachments: 50,
          reservedReplays: 500,
          reservedErrors: 2000000,
          reservedTransactions: 1000000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: null,
          softCapTypeTransactions: null,
          softCapTypeReplays: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeAttachments: null,
          trueForward: {
            errors: false,
            transactions: false,
            replays: false,
            monitorSeats: false,
            uptime: false,
            attachments: false,
          },
        },
      })
    );
  }, 15_000);
});
