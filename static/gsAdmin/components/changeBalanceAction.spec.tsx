import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

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
  });

  it('renders no balance', () => {
    triggerChangeBalanceModal({subscription, ...modalProps});

    renderGlobalModal();
    expect(screen.getByTestId('balance')).toHaveTextContent('$0.00 owed');
  });

  it('renders credit', () => {
    triggerChangeBalanceModal({
      subscription: {...subscription, accountBalance: -3000},
      orgId: organization.id,
      onSuccess,
    });

    renderGlobalModal();
    expect(screen.getByTestId('balance')).toHaveTextContent('$30.00 credit');
  });

  it('renders amount owed', () => {
    triggerChangeBalanceModal({
      subscription: {...subscription, accountBalance: 3000},
      ...modalProps,
    });

    renderGlobalModal();
    expect(screen.getByTestId('balance')).toHaveTextContent('$30.00 owed');
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
    await userEvent.type(screen.getByTestId('url-field'), url);
    await userEvent.type(screen.getByTestId('notes-field'), note);

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

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

  it('prevents double submission', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: OrganizationFixture(),
    });

    triggerChangeBalanceModal({subscription, ...modalProps});

    renderGlobalModal();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Credit Amount'}), '10');

    const submitButton = screen.getByRole('button', {name: 'Submit'});

    // Rapidly click submit button multiple times
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);

    // Should only call API once (double-clicks prevented)
    expect(updateMock).toHaveBeenCalledTimes(1);
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

    renderGlobalModal();
    const creditInput = screen.getByRole('spinbutton', {name: 'Credit Amount'});
    await userEvent.type(creditInput, '10');

    const submitButton = screen.getByRole('button', {name: 'Submit'});
    await userEvent.click(submitButton);

    // During submission, button should show "Submitting...", be disabled, and fields should be disabled
    expect(submitButton).toHaveTextContent('Submitting...');
    expect(submitButton).toBeDisabled();
    expect(creditInput).toBeDisabled();
    expect(screen.getByTestId('url-field')).toBeDisabled();
    expect(screen.getByTestId('notes-field')).toBeDisabled();
  });

  it('re-enables form after error', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid amount'},
      asyncDelay: 10,
    });

    triggerChangeBalanceModal({subscription, ...modalProps});
    renderGlobalModal();

    // Pre-grab stable references to fields using findBy to wait for modal content
    const creditInput = await screen.findByRole('spinbutton', {name: 'Credit Amount'});
    const urlField = await screen.findByTestId('url-field');
    const notesField = await screen.findByTestId('notes-field');
    const submitButton = screen.getByRole('button', {name: /submit/i});

    await userEvent.type(creditInput, '10');
    await waitFor(() => expect(creditInput).toHaveValue(10));

    // Wait for button to be enabled before clicking
    await waitFor(() => expect(submitButton).toBeEnabled());

    // Disable pointer-events check to avoid false positive in CI
    // where modal overlay may still be settling during initialization
    await userEvent.click(submitButton, {pointerEventsCheck: 0});

    // Wait for form to be re-enabled after error
    // Don't rely on error message text as the Form component shows different messages
    // depending on error response structure. All fields are controlled by isSubmitting
    // state, so if one is enabled, all should be enabled.
    await waitFor(() => expect(creditInput).toBeEnabled());

    // Verify all fields and submit button are re-enabled
    expect(urlField).toBeEnabled();
    expect(notesField).toBeEnabled();
    expect(submitButton).toBeEnabled();
  });
});
