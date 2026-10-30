import {OrganizationFixture} from 'sentry-fixture/organization';

import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addGiftBudgetAction} from 'admin/components/addGiftBudgetAction';

describe('addGiftBudgetAction', () => {
  it('selects a budget with the keyboard and submits its gift amount', async () => {
    const organization = OrganizationFixture();
    const firstBudget = SeerReservedBudgetFixture({id: '1', reservedBudget: 10_000});
    const secondBudget = SeerReservedBudgetFixture({id: '2', reservedBudget: 20_000});
    const subscription = SubscriptionFixture({
      organization,
      reservedBudgets: [firstBudget, secondBudget],
    });
    const onSuccess = jest.fn();
    const updateBudget = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {},
    });

    renderGlobalModal();
    act(() => {
      addGiftBudgetAction({organization, subscription, onSuccess});
    });

    expect(screen.getByRole('radiogroup', {name: 'Reserved Budget'})).toBeInTheDocument();
    const firstOption = screen.getByRole('radio', {name: /Reserved Budget: \$100\b/});
    const secondOption = screen.getByRole('radio', {name: /Reserved Budget: \$200\b/});
    expect(firstOption).toBeChecked();
    expect(secondOption).not.toBeChecked();

    await userEvent.click(firstOption);
    await userEvent.keyboard('{ArrowRight}');
    expect(secondOption).toBeChecked();
    expect(firstOption).not.toBeChecked();

    const giftAmount = screen.getByRole('spinbutton', {name: 'Gift Amount ($)'});
    await userEvent.clear(giftAmount);
    await userEvent.type(giftAmount, '25');
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'Test gift');
    expect(secondOption).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(updateBudget).toHaveBeenCalledWith(
      `/customers/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          freeReservedBudget: {
            id: secondBudget.id,
            freeBudget: 2500,
            categories: Object.keys(secondBudget.categories),
          },
          ticketUrl: null,
          notes: 'Test gift',
        },
      })
    );
  });
});
