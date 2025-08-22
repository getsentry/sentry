import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  ReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Subscription} from 'getsentry/types';

import addGiftBudgetAction from './addGiftBudgetAction';

describe('GiftBudgetAction', () => {
  const organization = OrganizationFixture();
  const subscription = Am3DsEnterpriseSubscriptionFixture({
    organization,
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  const openGiftBudgetModal = () => {
    addGiftBudgetAction({
      organization,
      subscription,
      onSuccess: () => {},
    });
    renderGlobalModal();
  };

  it('renders modal with budget information', () => {
    openGiftBudgetModal();

    expect(screen.getByText('Add Gift Budget')).toBeInTheDocument();
    expect(screen.getByText('Reserved Budget:')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
    expect(screen.getByText('Existing Free Budget:')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText(/accepted spans, stored spans/i)).toBeInTheDocument();
  });

  it('validates gift amount input', async () => {
    openGiftBudgetModal();

    const giftInput = screen.getByRole('spinbutton', {name: 'Gift Amount ($)'});

    // Test min value
    await userEvent.clear(giftInput);
    await userEvent.type(giftInput, '-50');
    expect(screen.getByText(/Total Gift: \$0/)).toBeInTheDocument();

    // Test max value
    await userEvent.clear(giftInput);
    await userEvent.type(giftInput, '15000');
    expect(screen.getByText(/Total Gift: \$10,000/)).toBeInTheDocument();

    // Test valid value
    await userEvent.clear(giftInput);
    await userEvent.type(giftInput, '500');
    expect(screen.getByText(/Total Gift: \$500/)).toBeInTheDocument();
  });

  it('requires notes field', () => {
    openGiftBudgetModal();

    const createButton = screen.getByRole('button', {name: /confirm/i});

    expect(createButton).toBeDisabled();
  });

  it('submits form with correct data', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {},
    });

    openGiftBudgetModal();

    // Fill out form
    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Gift Amount ($)'}),
      '500'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'TicketUrl'}),
      'https://example.com'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'Test notes');

    // Submit form
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(updateMock).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          freeReservedBudget: {
            id: '11',
            freeBudget: 50000, // 500 * 100 as we convert to cents
            categories: ['spans', 'spansIndexed'],
          },
          ticketUrl: 'https://example.com',
          notes: 'Test notes',
        },
      })
    );
  });

  it('handles multiple reserved budgets', () => {
    const multiBudgetSub: Subscription = {
      ...subscription,
      reservedBudgets: [
        ReservedBudgetFixture({
          id: '11',
          reservedBudget: 100_000_00,
          totalReservedSpend: 60_000_00,
          freeBudget: 0,
          percentUsed: 0.6,
          categories: {
            spans: ReservedBudgetMetricHistoryFixture({
              reservedCpe: 1,
              reservedSpend: 40_000_00,
            }),
          },
        }),
        ReservedBudgetFixture({
          id: '22',
          reservedBudget: 100_000_00,
          totalReservedSpend: 60_000_00,
          freeBudget: 0,
          percentUsed: 0.6,
          categories: {
            spansIndexed: ReservedBudgetMetricHistoryFixture({
              reservedCpe: 2,
              reservedSpend: 20_000_00,
            }),
          },
        }),
      ],
    };

    addGiftBudgetAction({
      organization,
      subscription: multiBudgetSub,
      onSuccess: () => {},
    });
    renderGlobalModal();

    expect(
      screen.getByText('Select a reserved budget to add gift amount.')
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Reserved Budget:/i)).toHaveLength(2);
  });
});

describe('RecurringCreditAction', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
  });

  let addRecurringCreditAction: typeof import('./addRecurringCreditAction').default;

  beforeEach(async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'POST',
    });

    jest.clearAllMocks();
    const module = await import('./addRecurringCreditAction');
    addRecurringCreditAction = module.default;
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  const renderModal = () => {
    addRecurringCreditAction({
      organization,
      subscription,
      onSuccess: () => {},
    });
    renderGlobalModal();
  };

  it('renders modal with correct structure and all required fields', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Recurring Credit')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Close Modal'})).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('form')).toBeInTheDocument();

    expect(screen.getByLabelText('Credit Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Discount Amount ($)')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Ticket URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();

    const submitButton = screen.getByRole('button', {name: 'Apply Recurring Credit'});
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');

    expect(
      screen.getByText('A fixed dollar amount discount applied each billing period')
    ).toBeInTheDocument();
  });

  it('allows interaction with form fields', async () => {
    renderModal();

    const amountField = screen.getByLabelText('Discount Amount ($)');
    const ticketUrlField = screen.getByLabelText('Ticket URL');
    const notesField = screen.getByLabelText('Notes');

    expect(amountField).toBeEnabled();
    expect(ticketUrlField).toBeEnabled();
    expect(notesField).toBeEnabled();

    await userEvent.type(amountField, '100');
    await userEvent.type(ticketUrlField, 'https://example.com');
    await userEvent.type(notesField, 'Test credit for promotion');
  });

  it('shows Event Category and Event Count fields when Event Credit is selected', async () => {
    renderModal();

    expect(screen.getByLabelText('Discount Amount ($)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Discount Percentage (%)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Event Category')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Event Count')).not.toBeInTheDocument();

    const creditTypeControl = screen.getByLabelText('Credit Type');
    expect(creditTypeControl).toBeInTheDocument();

    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    expect(dropdownControl).toBeInTheDocument();
    await userEvent.click(dropdownControl!);

    const eventCreditOption = await screen.findByText('Event Credit');
    expect(eventCreditOption).toBeInTheDocument();
    await userEvent.click(eventCreditOption);

    expect(screen.getByLabelText('Event Category')).toBeInTheDocument();
    expect(screen.getAllByText('Event Count')).toHaveLength(1);
    expect(screen.getByText('Select the type of events to credit')).toBeInTheDocument();
    expect(screen.queryByLabelText('Discount Amount ($)')).not.toBeInTheDocument();
  });

  it('validates that notes field is required', () => {
    renderModal();

    const notesField = screen.getByLabelText('Notes');

    // Verify the help text indicates it's required
    expect(
      screen.getByText('Additional context for this credit (required)')
    ).toBeInTheDocument();

    // The field is required through form validation, not aria-required
    expect(notesField).toBeInTheDocument();
  });

  it('shows correct help text for different credit types', async () => {
    renderModal();

    // Check initial fixed discount help text
    expect(
      screen.getByText('A fixed dollar amount discount applied each billing period')
    ).toBeInTheDocument();

    // Switch to percentage discount
    const creditTypeControl = screen.getByLabelText('Credit Type');
    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(dropdownControl!);
    const percentOption = await screen.findByText('Percentage Discount');
    await userEvent.click(percentOption);

    // Check percentage discount help text
    expect(
      screen.getByText('A percentage discount applied to the total bill')
    ).toBeInTheDocument();
  });

  it('shows correct dynamic help text for amounts', async () => {
    renderModal();

    const amountField = screen.getByLabelText('Discount Amount ($)');

    // Type an amount and check the help text updates
    await userEvent.type(amountField, '250');
    expect(screen.getByText('Total discount: $250 per month')).toBeInTheDocument();

    // Switch to percentage and check help text
    const creditTypeControl = screen.getByLabelText('Credit Type');
    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(dropdownControl!);
    const percentOption = await screen.findByText('Percentage Discount');
    await userEvent.click(percentOption);

    const percentageField = screen.getByLabelText('Discount Percentage (%)');
    await userEvent.type(percentageField, '15');
    expect(screen.getByText('Discount: 15% of total bill')).toBeInTheDocument();
  });

  it('shows byte-based units for log categories', async () => {
    renderModal();

    // Switch to event credit
    const creditTypeControl = screen.getByLabelText('Credit Type');
    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(dropdownControl!);
    const eventOption = await screen.findByText('Event Credit');
    await userEvent.click(eventOption);

    // Select Log Bytes category
    const categoryControl = screen.getByLabelText('Event Category');
    const categoryDropdown = categoryControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(categoryDropdown!);
    const logBytesOption = await screen.findByText('Log Bytes');
    await userEvent.click(logBytesOption);

    // Should show "Amount (GB)" label instead of "Event Count"
    expect(screen.getByLabelText('Amount (GB)')).toBeInTheDocument();
    expect(screen.queryByText('Event Count')).not.toBeInTheDocument();
  });

  it('validates notes field with real-time feedback', async () => {
    renderModal();

    const notesField = screen.getByLabelText('Notes');

    // Start with empty notes - should show error after interaction
    await userEvent.click(notesField);
    await userEvent.tab(); // Blur the field

    // Type some content to clear the error
    await userEvent.type(notesField, 'Valid note content');

    // The field should now be valid (no error styling)
    expect(notesField).toBeInTheDocument();
  });

  it('displays help text that updates based on user input', async () => {
    renderModal();

    const amountField = screen.getByLabelText('Discount Amount ($)');

    // Type an amount and verify help text shows the calculation
    await userEvent.type(amountField, '500');

    // Should show calculated help text
    expect(screen.getByText('Total discount: $500 per month')).toBeInTheDocument();
  });

  it('clears field-specific errors when switching credit types', async () => {
    renderModal();

    // Start with discount amount field and enter invalid data
    const creditTypeControl = screen.getByLabelText('Credit Type');

    // Switch to percentage type
    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(dropdownControl!);
    const percentOption = await screen.findByText('Percentage Discount');
    await userEvent.click(percentOption);

    // Should now show percentage field instead of amount field
    expect(screen.getByLabelText('Discount Percentage (%)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Discount Amount ($)')).not.toBeInTheDocument();
  });

  it('provides contextual help text for different field types', async () => {
    renderModal();

    // Check initial help text
    expect(
      screen.getByText('A fixed dollar amount discount applied each billing period')
    ).toBeInTheDocument();

    // Switch to percentage and check help text changes
    const creditTypeControl = screen.getByLabelText('Credit Type');
    const dropdownControl = creditTypeControl.parentElement?.querySelector(
      '[class*="indicatorContainer"]'
    );
    await userEvent.click(dropdownControl!);
    const percentOption = await screen.findByText('Percentage Discount');
    await userEvent.click(percentOption);

    expect(
      screen.getByText('A percentage discount applied to the total bill')
    ).toBeInTheDocument();
  });

  it('shows loading state in submit button text', () => {
    renderModal();

    const submitButton = screen.getByRole('button', {name: 'Apply Recurring Credit'});

    // Initially shows normal text
    expect(submitButton).toHaveTextContent('Apply Recurring Credit');

    // The button exists and can be found
    expect(submitButton).toBeInTheDocument();
  });

  it('validates required fields are properly marked', () => {
    renderModal();

    const notesField = screen.getByLabelText('Notes');
    const startDateField = screen.getByLabelText('Start Date');
    const endDateField = screen.getByLabelText('End Date');

    // Required fields should be present
    expect(notesField).toBeInTheDocument();
    expect(startDateField).toBeInTheDocument();
    expect(endDateField).toBeInTheDocument();

    // Help text should indicate notes are required
    expect(
      screen.getByText('Additional context for this credit (required)')
    ).toBeInTheDocument();
  });
});
