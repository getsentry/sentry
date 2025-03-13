import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {DataCategory} from 'sentry/types/core';

import triggerProvisionSubscription from 'admin/components/provisionSubscriptionAction';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {OnDemandBudgetMode} from 'getsentry/types';

describe('provisionSubscriptionAction', function () {
  const onSuccess = jest.fn();
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg});

  function getSpinbutton(name: string) {
    return screen.getByRole('spinbutton', {name});
  }

  async function clickCheckbox(name: string | RegExp) {
    await userEvent.click(screen.getByRole('checkbox', {name}), {
      delay: null,
      skipHover: true,
    });
  }

  async function typeNum(name: string, value: string) {
    await userEvent.click(getSpinbutton(name), {delay: null, skipHover: true});
    await userEvent.paste(value);
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders modal with form', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Plan'}));

    [
      'Business (am3)',
      'Team (am3)',
      'Business (am2)',
      'Team (am2)',
      'Business (am1)',
      'Team (am1)',
      'Business (mm2)',
      'Team (mm2)',
      'Enterprise (mm1)',
    ].forEach(plan =>
      expect(screen.getByRole('menuitemradio', {name: plan})).toBeInTheDocument()
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

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

    expect(screen.getByText('Soft Cap Type Errors')).toBeInTheDocument();
    expect(screen.getByText('Soft Cap Type Performance Units')).toBeInTheDocument();
    expect(screen.getByText('Soft Cap Type Attachments')).toBeInTheDocument();

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

    expect(getSpinbutton('Reserved Errors')).toBeInTheDocument();
    expect(getSpinbutton('Reserved Performance Units')).toBeInTheDocument();
    expect(getSpinbutton('Reserved Attachments (in GB)')).toBeInTheDocument();
    expect(getSpinbutton('Reserved Profile Duration (in hours)')).toBeInTheDocument();

    expect(getSpinbutton('Price for Errors')).toBeInTheDocument();
    expect(getSpinbutton('Price for Performance Units')).toBeInTheDocument();
    expect(getSpinbutton('Price for Attachments')).toBeInTheDocument();
    expect(getSpinbutton('Price for PCSS')).toBeInTheDocument();
    expect(getSpinbutton('Annual Contract Value')).toBeInTheDocument();
  });

  it('disables performance unit or span fields depending on plan chosen', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();

    // all fields disable initially
    expect(screen.getByLabelText('Reserved Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Spans')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Spans')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Profile Duration')).toBeDisabled();
    expect(screen.getByLabelText('Price for Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Price for Spans')).toBeDisabled();
    expect(screen.getByLabelText('Price for Profile Duration')).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

    // enable performance unit fields
    expect(screen.getByLabelText('Reserved Performance Units')).toBeEnabled();
    expect(screen.getByLabelText('Reserved Spans')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Spans')).toBeDisabled();
    expect(screen.getByLabelText('Price for Performance Units')).toBeEnabled();
    expect(screen.getByLabelText('Price for Spans')).toBeDisabled();
    // TODO: change to enabled when profile duration is enabled
    expect(screen.getByLabelText('Price for Profile Duration')).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am3)'
    );

    // enable span fields, disable performance unit fields
    expect(screen.getByLabelText('Reserved Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Spans')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Spans')).toBeEnabled();
    expect(screen.getByLabelText('Price for Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Price for Spans')).toBeEnabled();
    // TODO: change to enabled when profile duration is enabled
    expect(screen.getByLabelText('Price for Profile Duration')).toBeDisabled();
  });

  it('select coterm disables effectiveAt and atPeriodEnd', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();
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
    });

    renderGlobalModal();
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
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Credit Card'
    );

    expect(
      within(container).queryByLabelText('On-Demand Max Spend Type')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Error')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Performance Unit')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Replay')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Attachment')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).not.toBeInTheDocument();
  });

  it('shows manually invoiced on-demand type field when invoiced type is selected', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    expect(
      within(container).getByLabelText('On-Demand Max Spend Type')
    ).toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Error')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Performance Unit')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Replay')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Attachment')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).not.toBeInTheDocument();
  });

  it('enable manually invoiced on-demand enables on-demand CPE fields', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Error')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Performance Unit')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Replay')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Attachment')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).not.toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Error')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Performance Unit')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Replay')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Attachment')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).toBeInTheDocument();
  });

  it('disable manually invoiced on-demand hides on-demand CPE fields', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Error')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Performance Unit')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Replay')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Attachment')
    ).toBeInTheDocument();
    expect(
      within(container).getByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Disable'
    );

    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Error')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Performance Unit')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Replay')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Attachment')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Cron Monitor')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByLabelText('On-Demand Cost-Per-Uptime Monitor')
    ).not.toBeInTheDocument();
  });

  it('enable manually invoiced on-demand disables soft cap fields', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );
    expect(screen.getByLabelText('Soft Cap Type Errors')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Replays')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Attachments')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Monitor Seats')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Uptime')).toBeEnabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    expect(screen.getByLabelText('Soft Cap Type Errors')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Replays')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Attachments')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Monitor Seats')).toBeDisabled();
    expect(screen.getByLabelText('Soft Cap Type Uptime')).toBeDisabled();
  });

  it('disable manually invoiced on-demand does not disable soft cap fields', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Disable'
    );

    expect(screen.getByLabelText('Soft Cap Type Errors')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Performance Units')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Replays')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Attachments')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Monitor Seats')).toBeEnabled();
    expect(screen.getByLabelText('Soft Cap Type Uptime')).toBeEnabled();
  });

  it('renders spans fields based on selected plan', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      canProvisionDsPlan: true,
      onSuccess,
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am3)'
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
      'Business with Dynamic Sampling (am3)'
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

    await typeNum('Reserved Cost-Per-Accepted Span', '1');
    await typeNum('Reserved Cost-Per-Stored Span', '2');
    expect(
      within(container).getByLabelText('Price for Accepted Spans (Reserved Spans Budget)')
    ).toBeInTheDocument();
    expect(within(container).getByLabelText('Price for Stored Spans')).toHaveValue(0);
  });

  it('reserved CPE fields are cleared when non-DS plan is selected', async function () {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      canProvisionDsPlan: true,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business with Dynamic Sampling (am3)'
    );
    expect(screen.getByLabelText('Reserved Cost-Per-Accepted Span')).toBeEnabled();
    expect(screen.getByLabelText('Reserved Cost-Per-Stored Span')).toBeEnabled();

    await typeNum('Reserved Cost-Per-Accepted Span', '1');
    await typeNum('Reserved Cost-Per-Stored Span', '2');

    expect(screen.getByLabelText('Reserved Accepted Spans')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Accepted Spans')).toHaveValue(-2);
    expect(screen.getByLabelText('Reserved Stored Spans')).toBeDisabled();
    expect(screen.getByLabelText('Reserved Stored Spans')).toHaveValue(-2);

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am3)'
    );
    expect(
      screen.queryByLabelText('Reserved Cost-Per-Accepted Span')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Reserved Cost-Per-Stored Span')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reserved Spans')).toBeEnabled();
    expect(screen.queryByLabelText('Reserved Accepted Spans')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reserved Stored Spans')).not.toBeInTheDocument();
  });

  it('prefills the form based on the enterprise subscription', function () {
    const mockInvoicedSub = InvoicedSubscriptionFixture({
      organization: mockOrg,
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
          onDemandCpe: 84,
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
    });

    renderGlobalModal();

    expect(screen.getByText('Business (am2)')).toBeInTheDocument();
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

  it('select am1 enterprise enables custom prices', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: '',
      onSuccess,
    });

    renderGlobalModal();

    expect(getSpinbutton('Annual Contract Value')).toBeDisabled();
    expect(getSpinbutton('Price for Errors')).toBeDisabled();
    expect(getSpinbutton('Price for Performance Units')).toBeDisabled();
    expect(getSpinbutton('Price for Attachments')).toBeDisabled();
    expect(getSpinbutton('Price for PCSS')).toBeDisabled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

    expect(getSpinbutton('Annual Contract Value')).toBeEnabled();
    expect(getSpinbutton('Price for Errors')).toBeEnabled();
    expect(getSpinbutton('Price for Performance Units')).toBeEnabled();
    expect(getSpinbutton('Price for Attachments')).toBeEnabled();
    expect(getSpinbutton('Price for PCSS')).toBeEnabled();
  });

  it('calls api with correct am1 args', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
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

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    // await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '500');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '0');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '4950');

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
          customPrice: 495000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceTransactions: 100000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPriceReplays: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am1_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2000000,
          reservedTransactions: 1000000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedReplays: 500,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: 'ON_DEMAND',
          softCapTypeTransactions: null,
          softCapTypeReplays: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            errors: true,
            transactions: false,
            replays: false,
            monitor_seats: false,
            uptime: false,
            attachments: false,
            profile_duration: false,
          },
        },
      })
    );
  });

  it('retain on-demand budget shared', async () => {
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
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am2)'
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
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Retain On-Demand Budget');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '6450');

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
          customPrice: 645000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceTransactions: 100000,
          managed: true,
          onDemandInvoicedManual: 'SHARED',
          plan: 'am2_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2000000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedReplays: 75000,
          reservedTransactions: 1000000,
          retainOnDemandBudget: true,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeReplays: null,
          softCapTypeTransactions: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitor_seats: false,
            uptime: false,
            replays: false,
            transactions: false,
            profile_duration: false,
          },
          type: 'invoiced',
        },
      })
    );
  });

  it('remove retain on-demand budget toggle when plan changes', async () => {
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
    });

    const modal = renderGlobalModal();
    const container = modal.baseElement as HTMLElement;

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    expect(
      within(container).getByLabelText('Retain On-Demand Budget')
    ).toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Per Category'
    );

    expect(
      within(container).queryByLabelText('Retain On-Demand Budget')
    ).not.toBeInTheDocument();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am2)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '6450');

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
          customPrice: 645000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceTransactions: 100000,
          managed: true,
          onDemandInvoicedManual: 'PER_CATEGORY',
          plan: 'am2_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2000000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedReplays: 75000,
          reservedTransactions: 1000000,
          retainOnDemandBudget: false,
          softCapTypeAttachments: null,
          softCapTypeErrors: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeReplays: null,
          softCapTypeTransactions: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            attachments: false,
            errors: false,
            monitor_seats: false,
            uptime: false,
            replays: false,
            transactions: false,
            profile_duration: false,
          },
          type: 'invoiced',
        },
      })
    );
  });

  it('calls api with correct am2 args', async () => {
    const am2Sub = SubscriptionFixture({organization: mockOrg, plan: 'am2_f'});
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am2)'
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
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Disable'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Errors'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Replays'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Monitor Seats'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Uptime'}),
      'True Forward'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '6450');

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
          customPrice: 645000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPriceTransactions: 100000,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am2_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2_000_000,
          reservedReplays: 75_000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedTransactions: 1_000_000,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: 'TRUE_FORWARD',
          softCapTypeTransactions: null,
          softCapTypeReplays: 'TRUE_FORWARD',
          softCapTypeMonitorSeats: 'TRUE_FORWARD',
          softCapTypeUptime: 'TRUE_FORWARD',
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            errors: true,
            transactions: false,
            replays: true,
            monitor_seats: true,
            uptime: true,
            attachments: false,
            profile_duration: false,
          },
        },
      })
    );
  });

  it('calls api with correct am3 args', async () => {
    const am3Sub = SubscriptionFixture({organization: mockOrg, plan: 'am3_f'});
    triggerProvisionSubscription({
      subscription: am3Sub,
      orgId: am3Sub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am3)'
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
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Disable'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Errors'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Replays'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Monitor Seats'}),
      'True Forward'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Uptime'}),
      'True Forward'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Spans', '10000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Spans', '1000');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '6450');

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
          customPrice: 645000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPriceSpans: 100000,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2_000_000,
          reservedReplays: 75_000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedSpans: 10_000_000,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: 'TRUE_FORWARD',
          softCapTypeSpans: null,
          softCapTypeReplays: 'TRUE_FORWARD',
          softCapTypeMonitorSeats: 'TRUE_FORWARD',
          softCapTypeUptime: 'TRUE_FORWARD',
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            errors: true,
            spans: false,
            replays: true,
            monitor_seats: true,
            uptime: true,
            attachments: false,
            profile_duration: false,
          },
        },
      })
    );
  });

  it('calls api with correct am3 dynamic sampling args', async () => {
    const am3Sub = SubscriptionFixture({organization: mockOrg, plan: 'am3_f'});
    triggerProvisionSubscription({
      subscription: am3Sub,
      orgId: am3Sub.slug,
      onSuccess,
      canProvisionDsPlan: true,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business with Dynamic Sampling (am3)'
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
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Disable'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Soft Cap Type Accepted Spans'}),
      'True Forward'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Reserved Cost-Per-Accepted Span', '1');
    await typeNum('Reserved Cost-Per-Stored Span', '2');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Accepted Spans (Reserved Spans Budget)', '12000');
    await typeNum('Price for Stored Spans', '0');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '17450');

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
          customPrice: 17450_00,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPriceSpans: 1200000,
          customPriceSpansIndexed: 0,
          managed: true,
          onDemandInvoicedManual: 'DISABLE',
          plan: 'am3_business_ent_ds',
          reservedAttachments: 50,
          reservedErrors: 2_000_000,
          reservedReplays: 75_000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedSpans: RESERVED_BUDGET_QUOTA,
          reservedSpansIndexed: RESERVED_BUDGET_QUOTA,
          reservedCpeSpans: 100_000_000,
          reservedCpeSpansIndexed: 200_000_000,
          reservedBudgets: [
            {
              categories: ['spans', 'spansIndexed'],
              budget: 1200000,
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
          trueForward: {
            errors: false,
            spans: true,
            spansIndexed: false,
            replays: false,
            monitor_seats: false,
            uptime: false,
            attachments: false,
            profile_duration: false,
          },
        },
      })
    );
  });

  it('calls api with correct manually invoiced on-demand args', async () => {
    const am2Sub = SubscriptionFixture({organization: mockOrg, plan: 'am2_f'});
    triggerProvisionSubscription({
      subscription: am2Sub,
      orgId: am2Sub.slug,
      onSuccess,
    });
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am2)'
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
      screen.getByRole('textbox', {name: 'On-Demand Max Spend Type'}),
      'Shared'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '75000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '1500');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '6450');
    await typeNum('On-Demand Cost-Per-Error', '0.5');
    await typeNum('On-Demand Cost-Per-Performance Unit', '0.0111');
    await typeNum('On-Demand Cost-Per-Replay', '1');
    await typeNum('On-Demand Cost-Per-Attachment', '0.0002');

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
          customPrice: 645000,
          customPriceAttachments: 5000,
          customPriceErrors: 300000,
          customPricePcss: 50000,
          customPriceReplays: 150000,
          customPriceMonitorSeats: 40000,
          customPriceUptime: 0,
          customPriceTransactions: 100000,
          managed: true,
          onDemandCpeErrors: 50,
          onDemandCpeTransactions: 1.11,
          onDemandCpeReplays: 100,
          onDemandCpeAttachments: 0.02,
          onDemandInvoicedManual: 'SHARED',
          plan: 'am2_business_ent',
          reservedAttachments: 50,
          reservedErrors: 2_000_000,
          reservedReplays: 75_000,
          reservedMonitorSeats: 250,
          reservedUptime: 250,
          reservedTransactions: 1_000_000,
          retainOnDemandBudget: false,
          type: 'invoiced',
          softCapTypeErrors: null,
          softCapTypeTransactions: null,
          softCapTypeReplays: null,
          softCapTypeMonitorSeats: null,
          softCapTypeUptime: null,
          softCapTypeAttachments: null,
          softCapTypeProfileDuration: null,
          trueForward: {
            errors: false,
            transactions: false,
            profile_duration: false,
            replays: false,
            monitor_seats: false,
            uptime: false,
            attachments: false,
          },
        },
      })
    );
  }, 10_000);

  it('calls api with correct mm2 args', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (mm2)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await clickCheckbox('Apply Changes To Current Subscription');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Annual Contract Value', '4550');

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
  });

  it('returns submit error on incorrect custom price', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Replays', '500');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Replays', '0');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '5050');

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(
      screen.getByText('Custom Price must be equal to sum of SKU prices')
    ).toBeInTheDocument();
  });

  it('returns api error', async () => {
    triggerProvisionSubscription({
      subscription: mockSub,
      orgId: mockSub.slug,
      onSuccess,
    });

    renderGlobalModal();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Plan'}),
      'Business (am1)'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Interval'}),
      'Annual'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Billing Type'}),
      'Invoiced'
    );

    await clickCheckbox('Managed Subscription');
    await userEvent.type(screen.getByLabelText('Start Date'), '2020-10-25');
    await typeNum('Reserved Errors', '2000000');
    await typeNum('Reserved Performance Units', '1000000');
    await typeNum('Reserved Replays', '500');
    await typeNum('Reserved Monitor Seats', '250');
    await typeNum('Reserved Uptime', '250');
    await typeNum('Reserved Attachments (in GB)', '50');
    await typeNum('Price for Errors', '3000');
    await typeNum('Price for Performance Units', '1000');
    await typeNum('Price for Replays', '0');
    await typeNum('Price for Monitor Seats', '400');
    await typeNum('Price for Uptime', '0');
    await typeNum('Price for Attachments', '50');
    await typeNum('Price for PCSS', '500');
    await typeNum('Annual Contract Value', '4950');

    MockApiClient.clearMockResponses();
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-subscription/`,
      method: 'POST',
      statusCode: 500,
      body: {
        error: 'Internal error.',
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

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
          softCapTypeProfileDuration: null,
          trueForward: {
            errors: false,
            transactions: false,
            replays: false,
            monitor_seats: false,
            uptime: false,
            attachments: false,
            profile_duration: false,
          },
        },
      })
    );
  });
});
