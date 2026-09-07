import {OrganizationFixture} from 'sentry-fixture/organization';

import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addGiftBudgetAction} from 'admin/components/addGiftBudgetAction';

describe('addGiftBudgetAction', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('identifies the gifted budget by apiName', async () => {
    const organization = OrganizationFixture();
    const budget = SeerReservedBudgetFixture({id: 'platform-pool-uid'});
    const subscription = SubscriptionFixture({
      organization,
      reservedBudgets: [budget],
    });
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: subscription,
    });

    addGiftBudgetAction({
      organization,
      subscription,
      onSuccess: jest.fn(),
    });
    renderGlobalModal();

    await userEvent.clear(screen.getByRole('spinbutton', {name: 'Gift Amount ($)'}));
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Gift Amount ($)'}), '5');
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'Support request');
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            freeReservedBudget: {
              apiName: budget.apiName,
              freeBudget: 500,
            },
            ticketUrl: null,
            notes: 'Support request',
          },
        })
      )
    );
  });
});
