import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import AdminRelays from 'sentry/views/admin/adminRelays';

describe('AdminRelays', () => {
  const ENDPOINT = '/relays/';

  const rows = [
    {
      id: '1',
      relayId: 'relay-one',
      publicKey: 'PUBKEY1',
      firstSeen: '2023-01-01T00:00:00.000Z',
      lastSeen: '2023-01-02T00:00:00.000Z',
    },
    {
      id: '2',
      relayId: 'relay-two',
      publicKey: 'PUBKEY2',
      firstSeen: '2023-01-03T00:00:00.000Z',
      lastSeen: '2023-01-04T00:00:00.000Z',
    },
  ];

  it('renders rows', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: rows,
    });

    render(<AdminRelays />);

    expect(await screen.findByText('relay-one')).toBeInTheDocument();
    expect(screen.getByText('relay-two')).toBeInTheDocument();
    expect(screen.getByText('PUBKEY1')).toBeInTheDocument();
    expect(screen.getByText('PUBKEY2')).toBeInTheDocument();
  });

  it('deletes a relay via confirmation modal', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: rows,
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}1/`,
      method: 'DELETE',
    });

    render(<AdminRelays />);
    renderGlobalModal();

    const firstRow = await screen.findByText('relay-one');
    const rowEl = firstRow.closest('tr')!;

    await userEvent.click(within(rowEl).getByRole('button', {name: 'Remove Relay'}));

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
  });
});
