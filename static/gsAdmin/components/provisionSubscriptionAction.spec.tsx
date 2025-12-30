import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  fireEvent,
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

describe('provisionSubscriptionAction', () => {
  const onSuccess = jest.fn();
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg});
  const mockBillingConfig = BillingConfigFixture(PlanTier.ALL);

  function getSpinbutton(name: string) {
    return screen.getByRole('spinbutton', {name, hidden: true});
  }

  function getAllSpinbuttons(startsWith: string) {
    return screen.getAllByRole('spinbutton', {
      name: new RegExp(startsWith),
      hidden: true,
    });
  }

  async function clickCheckbox(name: string | RegExp) {
    await userEvent.click(await screen.findByRole('checkbox', {name, hidden: true}), {
      delay: null,
      skipHover: true,
      pointerEventsCheck: 0,
    });
  }

  function typeNum(field: HTMLElement, value: string, clearField: boolean) {
    if (clearField) {
      // Instead of clearing, clicking and updating. Directly update the field to the value which is more performant.
      fireEvent.change(field, {target: {value}});
      return;
    }

    // Append to existing value
    const currentValue = (field as HTMLInputElement).value || '';
    const newValue = currentValue + value;
    fireEvent.change(field, {target: {value: newValue}});
  }

  function typeNumForMatchingFields(
    startsWith: string,
    value: string,
    clearField = true
  ) {
    const matchingFields = getAllSpinbuttons(startsWith);
    for (const field of matchingFields) {
      typeNum(field, value, clearField);
    }
  }

  function typeNumForField(name: string, value: string, clearField = true) {
    const field = getSpinbutton(name);
    typeNum(field, value, clearField);
  }

  async function loadModal() {
    const modal = renderGlobalModal();
    expect(await screen.findByText('Provision Subscription Changes')).toBeInTheDocument();
    return modal;
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders modal with form', async () => {
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

  it('shows SKUs based on plan chosen', async () => {
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

  it('select coterm disables effectiveAt and atPeriodEnd', async () => {
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

  it('select atPeriodEnd disables coterm and effectiveAt', async () => {
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

  it('hides manually invoiced on-demand fields when credit card type is selected', async () => {
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

  it('shows manually invoiced on-demand type field when invoiced type is selected', async () => {
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
      within(container).getByLabelText('Pay-as-you-go Max Spend Setting')
    ).toBeInTheDocument();
    expect(
      within(container).queryByLabelText('Pay-as-you-go Cost-Per-Event Errors')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('Pay-as-you-go Cost-Per-Event Performance Units')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('Pay-as-you-go Cost-Per-Event Replays')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('Pay-as-you-go Cost-Per-Event Attachments')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('Pay-as-you-go Cost-Per-Event Cron Monitors')
    ).not.toBeInTheDocument();
  });

  it('shows or hides on-demand CPE fields based on setting', async () => {
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
      screen.getByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Shared'
    );
    expect(
      (await within(container).findAllByLabelText(/Pay-as-you-go Cost-Per-Event/)).length
    ).toBeGreaterThan(0);

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Disable'
    );
    expect(
      within(container).queryByLabelText(/Pay-as-you-go Cost-Per-Event/)
    ).not.toBeInTheDocument();
  });

  it('disables soft cap fields when enabling on-demand', async () => {
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
      screen.getByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Shared'
    );
    const disabledSoftCapFields = screen.getAllByLabelText(/Soft Cap Type/);
    expect(disabledSoftCapFields.length).toBeGreaterThan(0);
    disabledSoftCapFields.forEach(field => expect(field).toBeDisabled());
  });

  it('does not disable soft cap fields when on-demand is disabled', async () => {
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
      screen.getByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Disable'
    );
    const enabledSoftCapFields = screen.getAllByLabelText(/Soft Cap Type/);
    expect(enabledSoftCapFields.length).toBeGreaterThan(0);
    enabledSoftCapFields.forEach(field => expect(field).toBeEnabled());
  });

  it('renders spans fields based on selected plan', async () => {
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
    expect(
      within(container).queryByText(/reserved cost-per-event stored spans/i)
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByText(/reserved cost-per-event accepted spans/i)
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByText(/dynamic sampling arr/i)
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
    expect(within(container).queryByText('Dynamic Sampling ARR')).not.toBeInTheDocument();
    expect(within(container).getByLabelText('Reserved Stored Spans')).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Soft Cap Type Stored Spans')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('Price for Stored Spans')
    ).toBeInTheDocument();

    typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');
    expect(
      within(container).getByLabelText('Price for Accepted Spans (Dynamic Sampling ARR)')
    ).toBeInTheDocument();
    expect(within(container).getByLabelText('Price for Stored Spans')).toHaveValue(0);
    expect(within(container).getByLabelText('Price for Stored Spans')).toBeDisabled();
  });

  it('reserved CPE fields are cleared when non-DS plan is selected', async () => {
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

    typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');

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

  it('prefills the form based on the enterprise subscription', async () => {
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
    typeNumForField('Reserved Transactions', '200000');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Errors', '3000');
    typeNumForField('Price for Transactions', '1000');
    typeNumForField('Annual Contract Value', '4000');

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
          customPrice: 400000,
          customPriceAttachments: 0,
          customPriceErrors: 300000,
          customPriceMonitorSeats: 0,
          customPricePcss: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceTransactions: 100000,
          customPriceUptime: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am1_business_ent',
          reservedAttachments: 1,
          reservedBudgets: [],
          reservedErrors: 5000,
          reservedMonitorSeats: 1,
          reservedReplays: 50,
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedTransactions: 200000,
          reservedUptime: 1,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: 'ON_DEMAND',
          softCapTypeMonitorSeats: null,
          softCapTypeReplays: 'TRUE_FORWARD',
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeTransactions: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            replays: true,
            seerAutofix: false,
            seerScanner: false,
            transactions: false,
            uptime: false,
          },
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

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
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.1');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Annual Contract Value', '0');

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
            customPriceLogBytes: 0,
            customPriceMonitorSeats: 0,
            customPricePcss: 0,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            customPriceReplays: 0,
            customPriceSeerAutofix: 0,
            customPriceSeerScanner: 0,
            customPriceTransactions: 0,
            customPriceUptime: 0,
            managed: true,
            onDemandInvoicedManual: 'SHARED',
            paygCpeAttachments: 10000000,
            paygCpeErrors: 10000000,
            paygCpeLogBytes: 10000000,
            paygCpeMonitorSeats: 10000000,
            paygCpeProfileDuration: 10000000,
            paygCpeProfileDurationUI: 10000000,
            paygCpeReplays: 10000000,
            paygCpeSeerAutofix: 10000000,
            paygCpeSeerScanner: 10000000,
            paygCpeTransactions: 10000000,
            paygCpeUptime: 10000000,
            plan: 'am2_business_ent',
            reservedAttachments: 1,
            reservedBudgets: [],
            reservedErrors: 5000,
            reservedLogBytes: 5,
            reservedMonitorSeats: 1,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            reservedReplays: 50,
            reservedSeerAutofix: 0,
            reservedSeerScanner: 0,
            reservedTransactions: 10000,
            reservedUptime: 1,
            retainOnDemandBudget: true,
            softCapTypeAttachments: null,
            softCapTypeErrors: null,
            softCapTypeLogBytes: null,
            softCapTypeMonitorSeats: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            softCapTypeReplays: null,
            softCapTypeSeerAutofix: null,
            softCapTypeSeerScanner: null,
            softCapTypeTransactions: null,
            softCapTypeUptime: null,
            trueForward: {
              attachments: false,
              errors: false,
              monitorSeats: false,
              profileDuration: false,
              profileDurationUI: false,
              replays: false,
              seerAutofix: false,
              seerScanner: false,
              transactions: false,
              uptime: false,
              logBytes: false,
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
      await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Shared'
    );

    expect(
      within(container).getByLabelText('Retain Pay-as-you-go Budget')
    ).toBeInTheDocument();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Per Category'
    );

    expect(
      within(container).queryByLabelText('Retain Pay-as-you-go Budget')
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
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.1');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Annual Contract Value', '0');

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
          customPriceLogBytes: 0,
          customPriceMonitorSeats: 0,
          customPricePcss: 0,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceTransactions: 0,
          customPriceUptime: 0,
          managed: true,
          onDemandInvoicedManual: 'PER_CATEGORY',
          paygCpeAttachments: 10000000,
          paygCpeErrors: 10000000,
          paygCpeLogBytes: 10000000,
          paygCpeMonitorSeats: 10000000,
          paygCpeProfileDuration: 10000000,
          paygCpeProfileDurationUI: 10000000,
          paygCpeReplays: 10000000,
          paygCpeSeerAutofix: 10000000,
          paygCpeSeerScanner: 10000000,
          paygCpeTransactions: 10000000,
          paygCpeUptime: 10000000,
          plan: 'am2_business_ent',
          reservedAttachments: 1,
          reservedBudgets: [],
          reservedErrors: 5000,
          reservedLogBytes: 5,
          reservedMonitorSeats: 1,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedReplays: 50,
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedTransactions: 10000,
          reservedUptime: 1,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeLogBytes: null,
          softCapTypeMonitorSeats: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          softCapTypeReplays: null,
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeTransactions: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            profileDuration: false,
            profileDurationUI: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            transactions: false,
            uptime: false,
            logBytes: false,
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
    typeNumForField('Reserved Performance Units', '600000');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Errors', '3000');
    typeNumForField('Price for Uptime Monitors', '1000');
    typeNumForField('Annual Contract Value', '4000');

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
          customPrice: 400000,
          customPriceAttachments: 0,
          customPriceErrors: 300000,
          customPriceLogBytes: 0,
          customPriceMonitorSeats: 0,
          customPricePcss: 0,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceTransactions: 0,
          customPriceUptime: 100000,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am2_business_ent',
          reservedAttachments: 1,
          reservedBudgets: [],
          reservedErrors: 5000,
          reservedLogBytes: 5,
          reservedMonitorSeats: 1,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedReplays: 50,
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedTransactions: 600000,
          reservedUptime: 1,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: 'TRUE_FORWARD',
          softCapTypeLogBytes: null,
          softCapTypeMonitorSeats: 'ON_DEMAND',
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          softCapTypeReplays: 'ON_DEMAND',
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeTransactions: null,
          softCapTypeUptime: 'TRUE_FORWARD',
          trueForward: {
            attachments: false,
            errors: true,
            monitorSeats: false,
            profileDuration: false,
            profileDurationUI: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            transactions: false,
            uptime: true,
            logBytes: false,
          },
          type: 'invoiced',
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
    typeNumForField('Reserved Errors', '500000');
    typeNumForField('Reserved Attachments (in GB)', '10');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Spans', '2000');
    typeNumForField('Price for Replays', '4000');
    typeNumForField('Annual Contract Value', '6000');

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
            customPrice: 600000,
            customPriceAttachments: 0,
            customPriceErrors: 0,
            customPriceLogBytes: 0,
            customPriceMonitorSeats: 0,
            customPricePcss: 0,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            customPriceReplays: 400000,
            customPriceSeerAutofix: 0,
            customPriceSeerScanner: 0,
            customPriceSpans: 200000,
            customPriceUptime: 0,
            managed: true,
            onDemandInvoicedManual: 'DISABLE',
            plan: 'am3_business_ent',
            reservedAttachments: 10,
            reservedBudgets: [],
            reservedErrors: 500000,
            reservedLogBytes: 5,
            reservedMonitorSeats: 1,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            reservedReplays: 50,
            reservedSeerAutofix: 0,
            reservedSeerScanner: 0,
            reservedSpans: 10000000,
            reservedUptime: 1,
            retainOnDemandBudget: false,
            softCapTypeAttachments: null,
            softCapTypeErrors: 'ON_DEMAND',
            softCapTypeLogBytes: null,
            softCapTypeMonitorSeats: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            softCapTypeReplays: 'TRUE_FORWARD',
            softCapTypeSeerAutofix: null,
            softCapTypeSeerScanner: null,
            softCapTypeSpans: 'ON_DEMAND',
            softCapTypeUptime: 'TRUE_FORWARD',
            trueForward: {
              attachments: false,
              errors: false,
              monitorSeats: false,
              profileDuration: false,
              profileDurationUI: false,
              replays: true,
              seerAutofix: false,
              seerScanner: false,
              spans: false,
              uptime: true,
              logBytes: false,
            },
            type: 'invoiced',
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
      await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Disable'
    );

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Soft Cap Type Accepted Spans'}),
      'True Forward'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    typeNumForField('Reserved Replays', '75000');
    typeNumForField('Reserved Uptime Monitors', '250');
    typeNumForField('Reserved Cost-Per-Event Accepted Spans', '1');
    typeNumForField('Reserved Cost-Per-Event Stored Spans', '2');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Accepted Spans (Dynamic Sampling ARR)', '12000'); // custom price for stored spans is auto-filled to 0
    typeNumForField('Dynamic Sampling Budget', '12000');
    typeNumForField('Price for PCSS', '500');
    typeNumForField('Annual Contract Value', '12500');

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
          customPrice: 1250000,
          customPriceAttachments: 0,
          customPriceErrors: 0,
          customPriceLogBytes: 0,
          customPriceMonitorSeats: 0,
          customPricePcss: 50000,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceSpans: 1200000,
          customPriceSpansIndexed: 0,
          customPriceUptime: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent_ds',
          reservedAttachments: 1,
          reservedBudgets: [{budget: 1200000, categories: ['spans', 'spansIndexed']}],
          reservedCpeSpans: 100000000,
          reservedCpeSpansIndexed: 200000000,
          reservedErrors: 50000,
          reservedLogBytes: 5,
          reservedMonitorSeats: 1,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedReplays: 75000,
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedSpans: -2,
          reservedSpansIndexed: -2,
          reservedUptime: 250,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeLogBytes: null,
          softCapTypeMonitorSeats: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          softCapTypeReplays: null,
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeSpans: 'TRUE_FORWARD',
          softCapTypeSpansIndexed: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            profileDuration: false,
            profileDurationUI: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            spans: true,
            spansIndexed: false,
            uptime: false,
            logBytes: false,
          },
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

  it('calls api with correct seer reserved budget args', async () => {
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
      await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Disable'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    typeNumForField('Reserved Replays', '75000');
    typeNumForField('Reserved Uptime Monitors', '250');
    typeNumForField('Reserved Cost-Per-Event Issue Fixes', '1');
    typeNumForField('Reserved Cost-Per-Event Issue Scans', '0.5');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Issue Fixes (Seer ARR)', '12000');
    typeNumForField('Price for PCSS', '500');
    typeNumForField('Annual Contract Value', '12500');
    typeNumForField('Seer Budget', '24000');

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
          customPrice: 1250000,
          customPriceAttachments: 0,
          customPriceErrors: 0,
          customPriceLogBytes: 0,
          customPriceMonitorSeats: 0,
          customPricePcss: 50000,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 1200000,
          customPriceSeerScanner: 0,
          customPriceSpans: 0,
          customPriceUptime: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent',
          reservedAttachments: 1,
          reservedBudgets: [
            {budget: 2400000, categories: ['seerAutofix', 'seerScanner']},
          ],
          reservedCpeSeerAutofix: 100000000,
          reservedCpeSeerScanner: 50000000,
          reservedErrors: 50000,
          reservedLogBytes: 5,
          reservedMonitorSeats: 1,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedReplays: 75000,
          reservedSeerAutofix: -2,
          reservedSeerScanner: -2,
          reservedSpans: 10000000,
          reservedUptime: 250,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeLogBytes: null,
          softCapTypeMonitorSeats: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          softCapTypeReplays: null,
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeSpans: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            profileDuration: false,
            profileDurationUI: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            spans: false,
            uptime: false,
            logBytes: false,
          },
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

  it('calls api with seer reserved budget args with 0 values', async () => {
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
      await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
      'Disable'
    );

    await clickCheckbox('Apply Changes To Current Subscription');
    typeNumForField('Reserved Replays', '75000');
    typeNumForField('Reserved Uptime Monitors', '250');
    typeNumForField('Reserved Cost-Per-Event Issue Fixes', '0');
    typeNumForField('Reserved Cost-Per-Event Issue Scans', '0');
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Price for Issue Fixes (Seer ARR)', '0');
    typeNumForField('Price for PCSS', '500');
    typeNumForField('Annual Contract Value', '500');
    typeNumForField('Seer Budget', '24000');

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
          customPrice: 50000,
          customPriceAttachments: 0,
          customPriceErrors: 0,
          customPriceLogBytes: 0,
          customPriceMonitorSeats: 0,
          customPricePcss: 50000,
          customPriceProfileDuration: 0,
          customPriceProfileDurationUI: 0,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceSpans: 0,
          customPriceUptime: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent',
          reservedAttachments: 1,
          // CPE value of 0 does not create a reserved budget
          reservedBudgets: [],
          reservedErrors: 50000,
          reservedLogBytes: 5,
          reservedMonitorSeats: 1,
          reservedProfileDuration: 0,
          reservedProfileDurationUI: 0,
          reservedReplays: 75000,
          // CPE value of 0 does not modify the reserved field from its initial value
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedSpans: 10000000,
          reservedUptime: 250,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeLogBytes: null,
          softCapTypeMonitorSeats: null,
          softCapTypeProfileDuration: null,
          softCapTypeProfileDurationUI: null,
          softCapTypeReplays: null,
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeSpans: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            profileDuration: false,
            profileDurationUI: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            spans: false,
            uptime: false,
            logBytes: false,
          },
          type: 'invoiced',
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
    typeNumForMatchingFields('Price for', '0', false);
    typeNumForField('Annual Contract Value', '0');
    typeNumForMatchingFields('On-Demand Cost-Per-Event', '0.0001', false);
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForField('On-Demand Cost-Per-Event Errors', '0.5');
    typeNumForField('On-Demand Cost-Per-Event Performance Units', '0.0111');
    typeNumForField('On-Demand Cost-Per-Event Replays', '1');
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
            customPriceLogBytes: 0,
            customPriceMonitorSeats: 0,
            customPricePcss: 0,
            customPriceProfileDuration: 0,
            customPriceProfileDurationUI: 0,
            customPriceReplays: 0,
            customPriceSeerAutofix: 0,
            customPriceSeerScanner: 0,
            customPriceTransactions: 0,
            customPriceUptime: 0,
            managed: true,
            onDemandInvoicedManual: 'SHARED',
            paygCpeAttachments: 10000,
            paygCpeErrors: 50000000,
            paygCpeLogBytes: 10000,
            paygCpeMonitorSeats: 10000,
            paygCpeProfileDuration: 10000,
            paygCpeProfileDurationUI: 10000,
            paygCpeReplays: 100000000,
            paygCpeSeerAutofix: 10000,
            paygCpeSeerScanner: 10000,
            paygCpeTransactions: 1110000,
            paygCpeUptime: 10000,
            plan: 'am2_business_ent',
            reservedAttachments: 1,
            reservedBudgets: [],
            reservedErrors: 5000,
            reservedLogBytes: 5,
            reservedMonitorSeats: 1,
            reservedProfileDuration: 0,
            reservedProfileDurationUI: 0,
            reservedReplays: 50,
            reservedSeerAutofix: 0,
            reservedSeerScanner: 0,
            reservedTransactions: 10000,
            reservedUptime: 1,
            retainOnDemandBudget: false,
            softCapTypeAttachments: null,
            softCapTypeErrors: null,
            softCapTypeLogBytes: null,
            softCapTypeMonitorSeats: null,
            softCapTypeProfileDuration: null,
            softCapTypeProfileDurationUI: null,
            softCapTypeReplays: null,
            softCapTypeSeerAutofix: null,
            softCapTypeSeerScanner: null,
            softCapTypeTransactions: null,
            softCapTypeUptime: null,
            trueForward: {
              attachments: false,
              errors: false,
              logBytes: false,
              monitorSeats: false,
              profileDuration: false,
              profileDurationUI: false,
              replays: false,
              seerAutofix: false,
              seerScanner: false,
              transactions: false,
              uptime: false,
            },
            type: 'invoiced',
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
    typeNumForField('Reserved Errors', '2000000');
    typeNumForField('Annual Contract Value', '4550');

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
          customPrice: 455000,
          managed: true,
          plan: 'mm2_a',
          reservedBudgets: [],
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
    typeNumForField('Reserved Errors', '2000000');
    typeNumForField('Reserved Transactions', '1000000');
    typeNumForField('Reserved Cron Monitors', '250');
    typeNumForField('Reserved Uptime Monitors', '250');
    typeNumForField('Reserved Replays', '500');
    typeNumForField('Reserved Attachments (in GB)', '50');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForField('Price for Errors', '3000');
    typeNumForField('Price for Replays', '0');
    typeNumForField('Price for Cron Monitors', '400');
    typeNumForField('Price for Uptime Monitors', '0');
    typeNumForField('Price for Transactions', '1000');
    typeNumForField('Price for Attachments', '50');
    typeNumForField('Price for Issue Fixes', '0');
    typeNumForField('Price for Issue Scans', '0');
    typeNumForField('Price for PCSS', '500');
    typeNumForField('Annual Contract Value', '5050');

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
    typeNumForField('Reserved Errors', '2000000');
    typeNumForField('Reserved Transactions', '1000000');
    typeNumForField('Reserved Replays', '500');
    typeNumForField('Reserved Cron Monitors', '250');
    typeNumForField('Reserved Uptime Monitors', '250');
    typeNumForField('Reserved Attachments (in GB)', '50');
    typeNumForField('Reserved Issue Fixes', '0');
    typeNumForField('Reserved Issue Scans', '0');
    typeNumForField('Price for Errors', '3000');
    typeNumForField('Price for Transactions', '1000');
    typeNumForField('Price for Replays', '0');
    typeNumForField('Price for Cron Monitors', '400');
    typeNumForField('Price for Uptime Monitors', '0');
    typeNumForField('Price for Attachments', '50');
    typeNumForField('Price for Issue Fixes', '0');
    typeNumForField('Price for Issue Scans', '0');
    typeNumForField('Price for PCSS', '500');
    typeNumForField('Annual Contract Value', '4950');

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
          customPriceMonitorSeats: 40000,
          customPricePcss: 50000,
          customPriceReplays: 0,
          customPriceSeerAutofix: 0,
          customPriceSeerScanner: 0,
          customPriceTransactions: 100000,
          customPriceUptime: 0,
          effectiveAt: '2020-10-25',
          managed: true,
          plan: 'am1_business_ent',
          reservedAttachments: 50,
          reservedBudgets: [],
          reservedErrors: 2000000,
          reservedMonitorSeats: 250,
          reservedReplays: 500,
          reservedSeerAutofix: 0,
          reservedSeerScanner: 0,
          reservedTransactions: 1000000,
          reservedUptime: 250,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeMonitorSeats: null,
          softCapTypeReplays: null,
          softCapTypeSeerAutofix: null,
          softCapTypeSeerScanner: null,
          softCapTypeTransactions: null,
          softCapTypeUptime: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitorSeats: false,
            replays: false,
            seerAutofix: false,
            seerScanner: false,
            transactions: false,
            uptime: false,
          },
          type: 'invoiced',
        },
      })
    );
  }, 15_000);

  it('confirms byte field has (in GB) suffix', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    // Verify ATTACHMENTS has (in GB) suffix as expected
    expect(
      screen.getByRole('spinbutton', {name: 'Reserved Attachments (in GB)'})
    ).toBeInTheDocument();
  });

  it('confirms non-byte categories do not have (in GB) suffix', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    await selectEvent.select(
      await screen.findByRole('textbox', {name: 'Plan'}),
      'Enterprise (Business) (am1)'
    );

    // Non-byte categories should not have (in GB) suffix
    expect(screen.getByRole('spinbutton', {name: 'Reserved Errors'})).toBeInTheDocument();

    expect(
      screen.getByRole('spinbutton', {name: 'Reserved Transactions'})
    ).toBeInTheDocument();
  });

  describe('Seer category visibility based on organization features', () => {
    it('hides Issue Fixes and Issue Scans when organization has new Seer (seat-based)', async () => {
      const newSeerOrg = OrganizationFixture({
        features: ['seat-based-seer-enabled'],
      });
      const am3Sub = SubscriptionFixture({organization: newSeerOrg, plan: 'am3_f'});
      triggerProvisionSubscription({
        subscription: am3Sub,
        orgId: am3Sub.slug,
        onSuccess,
        billingConfig: mockBillingConfig,
        organization: newSeerOrg,
      });

      await loadModal();

      await selectEvent.select(
        await screen.findByRole('textbox', {name: 'Plan'}),
        'Enterprise (Business) (am3)'
      );

      expect(screen.queryByLabelText('Reserved Issue Fixes')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Reserved Issue Scans')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Price for Issue Fixes')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Price for Issue Scans')).not.toBeInTheDocument();

      expect(screen.getByLabelText('Reserved Errors')).toBeInTheDocument();
    });

    it('shows Issue Fixes and Issue Scans when organization has legacy Seer', async () => {
      const legacySeerOrg = OrganizationFixture({
        features: ['seer-added'],
      });
      const am3Sub = SubscriptionFixture({organization: legacySeerOrg, plan: 'am3_f'});
      triggerProvisionSubscription({
        subscription: am3Sub,
        orgId: am3Sub.slug,
        onSuccess,
        billingConfig: mockBillingConfig,
        organization: legacySeerOrg,
      });

      await loadModal();

      await selectEvent.select(
        await screen.findByRole('textbox', {name: 'Plan'}),
        'Enterprise (Business) (am3)'
      );

      expect(screen.getByLabelText('Reserved Issue Fixes')).toBeInTheDocument();
      expect(screen.getByLabelText('Reserved Issue Scans')).toBeInTheDocument();
      expect(screen.getByLabelText('Price for Issue Fixes')).toBeInTheDocument();
      expect(screen.getByLabelText('Price for Issue Scans')).toBeInTheDocument();
    });
  });

  describe('Reserved CPE field validation', () => {
    it('should set reserved to RESERVED_BUDGET_QUOTA when CPE has a valid positive value', async () => {
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
        await screen.findByRole('textbox', {name: 'Pay-as-you-go Max Spend Setting'}),
        'Disable'
      );

      await clickCheckbox('Apply Changes To Current Subscription');

      // Set valid CPE values
      typeNumForField('Reserved Cost-Per-Event Accepted Spans', '0.00005');
      typeNumForField('Reserved Cost-Per-Event Stored Spans', '0.00003');

      // Fill in other required fields
      typeNumForField('Reserved Replays', '75000');
      typeNumForField('Reserved Uptime Monitors', '250');
      typeNumForField('Reserved Issue Fixes', '0');
      typeNumForField('Reserved Issue Scans', '0');
      typeNumForMatchingFields('Price for', '0', false);
      typeNumForField('Price for Accepted Spans (Dynamic Sampling ARR)', '10000');
      typeNumForField('Dynamic Sampling Budget', '10000');
      typeNumForField('Price for PCSS', '500');
      typeNumForField('Annual Contract Value', '10500');

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/provision-subscription/`,
        method: 'POST',
        body: {},
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

      // Verify reserved is set to RESERVED_BUDGET_QUOTA when CPE has a valid value
      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${mockOrg.slug}/provision-subscription/`,
          expect.objectContaining({
            data: expect.objectContaining({
              reservedSpans: RESERVED_BUDGET_QUOTA,
              reservedSpansIndexed: RESERVED_BUDGET_QUOTA,
            }),
          })
        );
      });
    }, 15_000);

    it('should not modify reserved when CPE is zero', async () => {
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

      await clickCheckbox('Apply Changes To Current Subscription');

      // Set CPE to zero
      typeNumForField('Reserved Cost-Per-Event Issue Fixes', '0');
      typeNumForField('Reserved Cost-Per-Event Issue Scans', '0');

      // Fill in other required fields
      typeNumForField('Reserved Replays', '75000');
      typeNumForField('Reserved Uptime Monitors', '250');
      typeNumForMatchingFields('Price for', '0', false);
      typeNumForField('Price for PCSS', '500');
      typeNumForField('Annual Contract Value', '500');

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/provision-subscription/`,
        method: 'POST',
        body: {},
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

      // Verify reserved stays at initial value when CPE is 0
      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${mockOrg.slug}/provision-subscription/`,
          expect.objectContaining({
            data: expect.objectContaining({
              reservedSeerAutofix: 0,
              reservedSeerScanner: 0,
              reservedBudgets: [],
            }),
          })
        );
      });
    }, 15_000);

    it('should clear reserved when CPE is removed after setting valid value', async () => {
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

      await clickCheckbox('Apply Changes To Current Subscription');

      const cpeField = screen.getByLabelText('Reserved Cost-Per-Event Accepted Spans');
      const reservedField = screen.getByLabelText('Reserved Accepted Spans');

      // Set a valid CPE value
      fireEvent.change(cpeField, {target: {value: '0.00005'}});

      // Reserved field should be set to RESERVED_BUDGET_QUOTA
      await waitFor(() => {
        expect(reservedField).toHaveValue(RESERVED_BUDGET_QUOTA);
      });
      expect(reservedField).toBeDisabled();

      // Clear the CPE field
      fireEvent.change(cpeField, {target: {value: ''}});

      // Reserved field should be cleared from RESERVED_BUDGET_QUOTA
      await waitFor(() => {
        expect(reservedField).not.toHaveValue(RESERVED_BUDGET_QUOTA);
      });
      expect(reservedField).toBeEnabled();
    }, 15_000);
  });
});
