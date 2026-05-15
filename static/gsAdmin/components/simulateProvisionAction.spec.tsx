import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {triggerSimulateProvision} from 'admin/components/simulateProvisionAction';
import {PlanTier} from 'getsentry/types';

describe('simulateProvisionAction', () => {
  const mockOrg = OrganizationFixture();
  const mockSub = SubscriptionFixture({organization: mockOrg});
  const mockBillingConfig = BillingConfigFixture(PlanTier.ALL);

  const successResponse = {
    validation: {status: 'passed', errors: []},
    provisioning: {
      coterm: false,
      atPeriodEnd: false,
      effectiveAt: '2025-06-01',
      shiftContractDates: false,
      softCap: null,
      refundNeeded: false,
    },
    newDates: null,
    currentSubscription: {
      plan: 'am3_f',
      contractPeriodStart: '2025-01-01',
      contractPeriodEnd: '2026-01-01',
      billingPeriodStart: '2025-01-01',
      billingPeriodEnd: '2025-02-01',
      ondemandPeriodStart: '2025-01-01',
      ondemandPeriodEnd: '2025-02-01',
      billingDayOfMonth: 1,
      status: 'active',
      type: 'invoiced',
      managed: true,
    },
    preview: {
      invoiceItems: [
        {description: 'Enterprise Business Plan', amount: 120000},
        {description: 'Reserved Errors (500,000)', amount: 30000},
      ],
      totalAmount: 150000,
    },
  };

  const failedValidationResponse = {
    validation: {
      status: 'failed',
      errors: ['Unknown plan.', 'Contract dates are invalid.'],
    },
    provisioning: null,
    newDates: null,
    currentSubscription: {
      plan: 'am3_f',
      contractPeriodStart: '2025-01-01',
      contractPeriodEnd: '2026-01-01',
      billingPeriodStart: '2025-01-01',
      billingPeriodEnd: '2025-02-01',
      ondemandPeriodStart: '2025-01-01',
      ondemandPeriodEnd: '2025-02-01',
      billingDayOfMonth: 1,
      status: 'active',
      type: 'invoiced',
      managed: true,
    },
    preview: null,
  };

  const shiftDatesResponse = {
    ...successResponse,
    provisioning: {
      ...successResponse.provisioning,
      shiftContractDates: true,
    },
    newDates: {
      contractPeriodStart: '2025-06-01',
      contractPeriodEnd: '2026-06-01',
      billingPeriodStart: '2025-06-01',
      billingPeriodEnd: '2025-07-01',
    },
  };

  async function loadModal() {
    renderGlobalModal();
    expect(await screen.findByText('Simulate Provisioning')).toBeInTheDocument();
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders modal with form fields', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    expect(screen.getByLabelText('Plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Contract Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Contract End Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Deal Terms')).toBeInTheDocument();
    expect(screen.getByLabelText('Comments')).toBeInTheDocument();
    expect(screen.getByLabelText('Billing Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Reserved Errors')).toBeInTheDocument();
    expect(screen.getByLabelText('Reserved Attachments')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom Price')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Simulate'})).toBeInTheDocument();
  });

  it('submits simulation request with correct data', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    const simulateMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(simulateMock).toHaveBeenCalledWith(
        `/customers/${mockOrg.slug}/provision-simulate/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            contractPeriodStart: '2025-06-01',
            contractPeriodEnd: '2026-06-01',
          }),
        })
      );
    });
  });

  it('displays passed validation results', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    expect(await screen.findByText(/passed/i)).toBeInTheDocument();
  });

  it('displays failed validation results', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      statusCode: 400,
      body: failedValidationResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText('Unknown plan.')).toBeInTheDocument();
    expect(screen.getByText('Contract dates are invalid.')).toBeInTheDocument();
  });

  it('displays provisioning computed fields', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(screen.getByText(/coterm/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/atPeriodEnd/i)).toBeInTheDocument();
    expect(screen.getByText(/effectiveAt/i)).toBeInTheDocument();
    expect(screen.getByText(/shiftContractDates/i)).toBeInTheDocument();
  });

  it('displays new dates when shift is needed', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: shiftDatesResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(screen.getByText('2025-06-01')).toBeInTheDocument();
    });
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('displays invoice preview', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(screen.getByText('Enterprise Business Plan')).toBeInTheDocument();
    });
    expect(screen.getByText('Reserved Errors (500,000)')).toBeInTheDocument();
  });

  it('shows loading state during request', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      statusCode: 500,
      body: {error: 'Internal server error'},
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('does not close modal after simulation', async () => {
    triggerSimulateProvision({
      subscription: mockSub,
      orgId: mockOrg.slug,
      billingConfig: mockBillingConfig,
    });

    await loadModal();

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/provision-simulate/`,
      method: 'POST',
      body: successResponse,
    });

    await userEvent.type(screen.getByLabelText('Contract Start Date'), '2025-06-01');
    await userEvent.type(screen.getByLabelText('Contract End Date'), '2026-06-01');

    await userEvent.click(screen.getByRole('button', {name: 'Simulate'}));

    await waitFor(() => {
      expect(screen.getByText(/passed/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Simulate Provisioning')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Simulate'})).toBeInTheDocument();
  });
});
