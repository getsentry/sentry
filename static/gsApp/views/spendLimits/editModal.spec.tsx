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

  function makeProps() {
    return {
      organization,
      subscription,
      closeModal: jest.fn(),
      Body: ModalBody,
      CloseButton: makeCloseButton(jest.fn()),
      Header: makeClosableHeader(jest.fn()),
      Footer: ModalFooter,
    };
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });
  });

  it('saves the budget and closes the modal', async () => {
    const props = makeProps();
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      body: {},
    });

    render(<SpendLimitsEditModal {...props} />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(request).toHaveBeenCalledWith(
      `/customers/${organization.slug}/ondemand-budgets/`,
      expect.objectContaining({
        method: 'POST',
        data: {budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 5000},
      })
    );
    expect(props.closeModal).toHaveBeenCalled();
  });

  it('shows field errors from the response and stays open', async () => {
    const props = makeProps();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 400,
      body: {sharedMaxBudget: ['Budget is too high.']},
    });

    render(<SpendLimitsEditModal {...props} />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Budget is too high.')).toBeInTheDocument();
    expect(props.closeModal).not.toHaveBeenCalled();
  });

  it('shows the detail message from a payment required response', async () => {
    const props = makeProps();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 402,
      body: {detail: 'A payment source is required to continue.'},
    });

    render(<SpendLimitsEditModal {...props} />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('A payment source is required to continue.')
    ).toBeInTheDocument();
    expect(props.closeModal).not.toHaveBeenCalled();
  });

  it('shows field errors returned as plain strings', async () => {
    const props = makeProps();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 400,
      body: {sharedMaxBudget: 'Budget is too high.'},
    });

    render(<SpendLimitsEditModal {...props} />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Budget is too high.')).toBeInTheDocument();
    expect(props.closeModal).not.toHaveBeenCalled();
  });
});
