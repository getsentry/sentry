import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import triggerChangeBalanceModal from 'admin/components/changeBalanceAction';

describe('BalanceChangeAction', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, accountBalance: 0});

  const modalProps = {
    orgId: organization.slug,
    onSuccess,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('renders no balance', async () => {
    triggerChangeBalanceModal({subscription, ...modalProps});

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$0.00 owed');
  });

  it('renders credit', async () => {
    triggerChangeBalanceModal({
      subscription: {...subscription, accountBalance: -3000},
      orgId: organization.id,
      onSuccess,
    });

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$30.00 credit');
  });

  it('renders amount owed', async () => {
    triggerChangeBalanceModal({
      subscription: {...subscription, accountBalance: 3000},
      ...modalProps,
    });

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$30.00 owed');
  });

  it('can submit balance change', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: OrganizationFixture(),
    });

    triggerChangeBalanceModal({subscription, ...modalProps});

    const {waitForModalToHide} = renderGlobalModal();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Credit Amount'}), '30');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            creditAmount: 3000,
            ticketUrl: '',
            notes: '',
          },
        })
      );
    });
  });

  it('can submit balance change with zendesk ticket and note', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: OrganizationFixture(),
    });

    triggerChangeBalanceModal({subscription, ...modalProps});
    const url = 'https://sentry.zendesk.com/agent/tickets/12345';
    const note = 'for notes';

    const {waitForModalToHide} = renderGlobalModal();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Credit Amount'}), '-10');
    await userEvent.type(screen.getByRole('textbox', {name: 'Ticket URL'}), url);
    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), note);

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            creditAmount: -1000,
            ticketUrl: url,
            notes: note,
          },
        })
      );
    });
  });

  it('prevents double submission', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: OrganizationFixture(),
    });

    triggerChangeBalanceModal({subscription, ...modalProps});

    const {waitForModalToHide} = renderGlobalModal();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Credit Amount'}), '10');

    const submitButton = screen.getByRole('button', {name: 'Submit'});

    // Rapidly click submit button multiple times
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);

    // Should only call API once (double-clicks prevented)
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
    await waitForModalToHide();
  });

  it('disables form fields during submission', async () => {
    // Mock with delay to keep isSubmitting true during test
    MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: OrganizationFixture(),
      asyncDelay: 100,
    });

    triggerChangeBalanceModal({subscription, ...modalProps});

    const {waitForModalToHide} = renderGlobalModal();
    const creditInput = await screen.findByRole('spinbutton', {name: 'Credit Amount'});
    await userEvent.type(creditInput, '10');

    const submitButton = screen.getByRole('button', {name: 'Submit'});
    await userEvent.click(submitButton);

    // During submission, button should show "Submitting...", be disabled, and fields should be disabled
    expect(submitButton).toHaveTextContent('Submitting...');
    expect(submitButton).toBeDisabled();
    expect(creditInput).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Ticket URL'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Notes'})).toBeDisabled();
    await waitForModalToHide();
  });

  it('re-enables form after error', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid amount'},
    });

    triggerChangeBalanceModal({subscription, ...modalProps});
    renderGlobalModal();

    expect(
      await screen.findByRole('spinbutton', {name: 'Credit Amount'})
    ).toBeInTheDocument();
    expect(await screen.findByRole('textbox', {name: 'Ticket URL'})).toBeInTheDocument();
    expect(await screen.findByRole('textbox', {name: 'Notes'})).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Credit Amount'), '10');

    expect(await screen.findByRole('button', {name: /submit/i})).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: /submit/i})).toBeEnabled()
    );

    // Disable pointer-events check to avoid false positive in CI
    // where modal overlay may still be settling during initialization
    await userEvent.click(screen.getByRole('button', {name: /submit/i}), {
      pointerEventsCheck: 0,
    });
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {creditAmount: 1000, notes: '', ticketUrl: ''},
        })
      );
    });

    await waitFor(
      () => {
        expect(screen.getByLabelText('Credit Amount')).toBeEnabled();
      },
      {timeout: 5_000}
    );
    expect(screen.getByRole('textbox', {name: 'Ticket URL'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Notes'})).toBeEnabled();
    expect(screen.getByRole('button', {name: /submit/i})).toBeEnabled();
  }, 25_000);
});
