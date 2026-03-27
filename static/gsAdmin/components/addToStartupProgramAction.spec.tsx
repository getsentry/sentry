import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ModalStore} from 'sentry/stores/modalStore';

import {triggerAddToStartupProgramModal} from 'admin/components/addToStartupProgramAction';

describe('AddToStartupProgramAction', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, accountBalance: 0});

  const modalProps = {
    orgId: organization.slug,
    onSuccess,
    subscription,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
    onSuccess.mockClear();
  });

  it('renders modal with current balance', async () => {
    triggerAddToStartupProgramModal(modalProps);

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$0.00 owed');
    expect(screen.getByText('Add to Startup Program')).toBeInTheDocument();
  });

  it('renders credit balance', async () => {
    triggerAddToStartupProgramModal({
      ...modalProps,
      subscription: {...subscription, accountBalance: -3000},
    });

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$30.00 credit');
  });

  it('renders amount owed', async () => {
    triggerAddToStartupProgramModal({
      ...modalProps,
      subscription: {...subscription, accountBalance: 3000},
    });

    renderGlobalModal();
    expect(await screen.findByTestId('balance')).toHaveTextContent('$30.00 owed');
  });

  it('has default values for credit amount and program', async () => {
    triggerAddToStartupProgramModal(modalProps);

    renderGlobalModal();
    expect(await screen.findByRole('spinbutton', {name: 'Credit Amount'})).toHaveValue(
      5000
    );
    expect(screen.getByText('Sentry for Startups')).toBeInTheDocument();
  });

  it('can submit with default values', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: {},
    });

    triggerAddToStartupProgramModal(modalProps);

    const {waitForModalToHide} = renderGlobalModal();
    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            creditAmount: 500000,
            ticketUrl: '',
            notes: 'sentryforstartups',
          },
        })
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('can submit with a different program selected', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: {},
    });

    triggerAddToStartupProgramModal(modalProps);

    const {waitForModalToHide} = renderGlobalModal();

    // Change the program dropdown
    await userEvent.click(await screen.findByText('Sentry for Startups'));
    await userEvent.click(screen.getByText('Y Combinator'));

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            creditAmount: 500000,
            ticketUrl: '',
            notes: 'ycombinator',
          },
        })
      );
    });
  });

  it('shows custom notes field when "Other" is selected', async () => {
    triggerAddToStartupProgramModal(modalProps);

    renderGlobalModal();

    // Custom notes should not be visible initially
    expect(screen.queryByRole('textbox', {name: 'Custom Notes'})).not.toBeInTheDocument();

    // Select "Other"
    await userEvent.click(await screen.findByText('Sentry for Startups'));
    await userEvent.click(screen.getByText('Other'));

    // Custom notes field should now be visible
    expect(screen.getByRole('textbox', {name: 'Custom Notes'})).toBeInTheDocument();
  });

  it('can submit with custom notes when "Other" is selected', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: {},
    });

    triggerAddToStartupProgramModal(modalProps);
    const url = 'https://sentry.zendesk.com/agent/tickets/12345';

    const {waitForModalToHide} = renderGlobalModal();

    const creditInput = await screen.findByRole('spinbutton', {name: 'Credit Amount'});
    await userEvent.clear(creditInput);
    await userEvent.type(creditInput, '100');

    await userEvent.type(screen.getByRole('textbox', {name: 'Ticket URL'}), url);

    // Select "Other" to show custom notes
    await userEvent.click(screen.getByText('Sentry for Startups'));
    await userEvent.click(screen.getByText('Other'));

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Custom Notes'}),
      'custom note'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/balance-changes/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            creditAmount: 10000,
            ticketUrl: url,
            notes: 'custom note',
          },
        })
      );
    });
  });

  it('disables form fields during submission', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: {},
      asyncDelay: 100,
    });

    triggerAddToStartupProgramModal(modalProps);

    const {waitForModalToHide} = renderGlobalModal();
    const submitButton = await screen.findByRole('button', {name: 'Submit'});
    await userEvent.click(submitButton);

    expect(submitButton).toHaveTextContent('Submitting...');
    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('spinbutton', {name: 'Credit Amount'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Ticket URL'})).toBeDisabled();
    await waitForModalToHide();
  });

  it('prevents double submission', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      body: {},
    });

    triggerAddToStartupProgramModal(modalProps);

    const {waitForModalToHide} = renderGlobalModal();
    const submitButton = await screen.findByRole('button', {name: 'Submit'});

    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
    await waitForModalToHide();
  });

  it('re-enables form after error', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/balance-changes/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid amount'},
    });

    triggerAddToStartupProgramModal(modalProps);
    renderGlobalModal();

    const submitButton = await screen.findByRole('button', {name: /submit/i});
    await waitFor(() => expect(submitButton).toBeEnabled());

    await userEvent.click(submitButton, {pointerEventsCheck: 0});

    await waitFor(
      () => {
        expect(screen.getByRole('spinbutton', {name: 'Credit Amount'})).toBeEnabled();
      },
      {timeout: 5_000}
    );
    expect(screen.getByRole('textbox', {name: 'Ticket URL'})).toBeEnabled();
    expect(screen.getByRole('button', {name: /submit/i})).toBeEnabled();
  }, 25_000);

  it('closes modal on cancel', async () => {
    triggerAddToStartupProgramModal(modalProps);

    const {waitForModalToHide} = renderGlobalModal();
    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));
    await waitForModalToHide();
  });
});
