import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton, ModalBody, ModalFooter} from '@sentry/scraps/modal';

import SpendLimitsEditModal from 'getsentry/views/spendLimits/editModal';

describe('SpendLimitsEditModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('submits the updated spending limit through the form', async () => {
    const organization = OrganizationFixture({features: ['ondemand-budgets']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      onDemandMaxSpend: 0,
    });
    const closeModal = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
    });

    render(
      <SpendLimitsEditModal
        Header={() => <div />}
        Body={ModalBody}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        organization={organization}
        subscription={subscription}
      />
    );

    const input = screen.getByRole('textbox', {
      name: 'Custom shared spending limit (in dollars)',
    });
    await userEvent.clear(input);
    await userEvent.type(input, '123');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/customers/${organization.slug}/ondemand-budgets/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            budgetMode: 'shared',
            sharedMaxBudget: 12_300,
          },
        })
      )
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('submits per-product limits after changing the budget mode', async () => {
    const organization = OrganizationFixture({features: ['ondemand-budgets']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      onDemandMaxSpend: 0,
    });
    const closeModal = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
    });

    render(
      <SpendLimitsEditModal
        Header={() => <div />}
        Body={ModalBody}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        organization={organization}
        subscription={subscription}
      />
    );

    await userEvent.click(
      screen.getByRole('radio', {name: 'Per-category spending limit mode'})
    );
    const errorsInput = screen.getByRole('textbox', {
      name: 'Custom errors spending limit (in dollars)',
    });
    await userEvent.clear(errorsInput);
    await userEvent.type(errorsInput, '5');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/customers/${organization.slug}/ondemand-budgets/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            budgetMode: 'per_category',
            budgets: expect.objectContaining({errors: 500}),
          },
        })
      )
    );
  });

  it('preserves edited limits when switching budget modes', async () => {
    const organization = OrganizationFixture({features: ['ondemand-budgets']});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      onDemandMaxSpend: 0,
    });
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'GET',
    });

    render(
      <SpendLimitsEditModal
        Header={() => <div />}
        Body={ModalBody}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(jest.fn())}
        closeModal={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    const input = screen.getByRole('textbox', {
      name: 'Custom shared spending limit (in dollars)',
    });
    await userEvent.clear(input);
    await userEvent.type(input, '123');
    await userEvent.click(
      screen.getByRole('radio', {name: 'Per-category spending limit mode'})
    );
    await userEvent.click(
      screen.getByRole('radio', {name: 'Shared spending limit mode'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/customers/${organization.slug}/ondemand-budgets/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            budgetMode: 'shared',
            sharedMaxBudget: 12_300,
          },
        })
      )
    );
  });
});
