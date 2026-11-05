import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {closeModal} from '@sentry/scraps/modal';

import {triggerGrantLedgerCreditModal} from 'admin/components/grantLedgerCreditAction';

const WALLET_UID = '8ee96181-c10a-4fe1-8e00-08af59522463';

describe('GrantLedgerCreditAction', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();
  const url = `/_admin/customers/${organization.slug}/ledger-grants/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    closeModal();
    onSuccess.mockClear();
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {lineItems: [{uid: WALLET_UID, name: 'Seer Credit', balanceCents: 1250}]},
    });
  });

  async function selectLineItemAndAmount() {
    await userEvent.click(await screen.findByRole('textbox', {name: 'Line Item'}));
    await userEvent.click(screen.getByText('Seer Credit (balance $12.50)'));
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Amount'}), '25');
  }

  it('grants credit to the selected line item in cents', async () => {
    const grantMock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {invoiceId: 1, invoiceGuid: 'abc'},
    });

    triggerGrantLedgerCreditModal({orgId: organization.slug, onSuccess});
    const {waitForModalToHide} = renderGlobalModal();

    await selectLineItemAndAmount();
    expect(screen.queryByRole('textbox', {name: 'Client Key'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Grant Credit'}));

    await waitForModalToHide();
    expect(grantMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        data: {
          lineItemUid: WALLET_UID,
          amount: 2500,
          multipleGrantsToday: false,
          ticketUrl: '',
          notes: '',
        },
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('asks for a client key only after confirming multiple grants today', async () => {
    const grantMock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {invoiceId: 2, invoiceGuid: 'def'},
    });

    triggerGrantLedgerCreditModal({orgId: organization.slug, onSuccess});
    const {waitForModalToHide} = renderGlobalModal();

    await selectLineItemAndAmount();
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I am providing multiple grants to this customer in one day',
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Grant Credit'}));
    expect(
      await screen.findByText(
        'Enter a client key to tell this grant apart from earlier ones today'
      )
    ).toBeInTheDocument();
    expect(grantMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Client Key'}), 'zd-1234');
    await userEvent.click(screen.getByRole('button', {name: 'Grant Credit'}));

    await waitForModalToHide();
    expect(grantMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: expect.objectContaining({multipleGrantsToday: true, clientKey: 'zd-1234'}),
      })
    );
  });

  it('shows the error when the customer already received a grant today', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 409,
      body: {detail: 'This customer already received a grant for this line item today.'},
    });

    triggerGrantLedgerCreditModal({orgId: organization.slug, onSuccess});
    renderGlobalModal();

    await selectLineItemAndAmount();
    await userEvent.click(screen.getByRole('button', {name: 'Grant Credit'}));

    await waitFor(() => expect(onSuccess).not.toHaveBeenCalled());
    expect(screen.getByRole('button', {name: 'Grant Credit'})).toBeInTheDocument();
  });
});
