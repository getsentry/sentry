import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {OnDemandBudgetMode} from 'getsentry/types';
import {SpendLimitsEditModal} from 'getsentry/views/spendLimits/editModal';

describe('SpendLimitsEditModal', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_business',
    onDemandMaxSpend: 5000,
    onDemandBudgets: {
      enabled: true,
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 5000,
      onDemandSpendUsed: 0,
    },
  });

  function renderModal(closeModal = jest.fn()) {
    render(
      <SpendLimitsEditModal
        organization={organization}
        subscription={subscription}
        closeModal={closeModal}
        Body={ModalBody}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });
  });

  it('saves the budget and closes the modal', async () => {
    const closeModal = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      body: {},
    });

    renderModal(closeModal);
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(request).toHaveBeenCalledWith(
      `/customers/${organization.slug}/ondemand-budgets/`,
      expect.objectContaining({
        method: 'POST',
        data: {budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 5000},
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('shows field errors from the response and stays open', async () => {
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 400,
      body: {sharedMaxBudget: ['Budget is too high.']},
    });

    renderModal(closeModal);
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Budget is too high.')).toBeInTheDocument();
    expect(closeModal).not.toHaveBeenCalled();
  });
});
