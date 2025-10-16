import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
});
