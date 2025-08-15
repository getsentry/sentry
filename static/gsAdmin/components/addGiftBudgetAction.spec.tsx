import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  ReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {Am3DsEnterpriseSubscriptionFixture} from 'getsentry-test/fixtures/subscription';
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
