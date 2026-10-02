import {MemberFixture} from 'sentry-fixture/member';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {InvestigationViewers} from 'sentry/views/investigations/detail/presence';

const presenceUrl = '/organizations/org-slug/investigations/investigation-1/presence/';
const active = UserFixture({id: '2', name: 'Alice Smith', email: 'alice@example.com'});
const earlier = UserFixture({id: '3', name: 'Bob Jones', email: 'bob@example.com'});

function mockPresence(body: Record<string, unknown>) {
  return MockApiClient.addMockResponse({
    url: presenceUrl,
    method: 'PUT',
    body: {heartbeatIntervalMs: 5000, ...body},
  });
}

describe('InvestigationViewers', () => {
  it('shows active and earlier viewers after the separator', async () => {
    const heartbeat = mockPresence({
      total: 2,
      viewers: [
        {userId: '2', lastSeen: '2026-09-30T12:00:00Z', active: true},
        {userId: '3', lastSeen: '2026-09-30T10:00:00Z', active: false},
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture({user: active}), MemberFixture({user: earlier})],
    });

    render(<InvestigationViewers investigationId="investigation-1" separator="|" />);

    await userEvent.hover(await screen.findByTitle('Alice Smith'));
    expect(await screen.findByText('Alice Smith is viewing now')).toBeInTheDocument();
    await userEvent.hover(screen.getByTitle('Bob Jones'));
    expect(await screen.findByText(/Bob Jones viewed/)).toBeInTheDocument();
    expect(screen.getByText('|')).toBeInTheDocument();
    expect(heartbeat).toHaveBeenCalledWith(
      presenceUrl,
      expect.objectContaining({query: {limit: 6}})
    );
  });

  it('counts the viewers beyond the ones shown', async () => {
    mockPresence({
      total: 9,
      viewers: [{userId: '2', lastSeen: '2026-09-30T12:00:00Z', active: true}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture({user: active})],
    });

    render(<InvestigationViewers investigationId="investigation-1" />);

    expect(await screen.findByText('+8')).toBeInTheDocument();
  });

  it('renders nothing, not even the separator, when nobody else has viewed it', async () => {
    const heartbeat = mockPresence({total: 0, viewers: []});

    render(<InvestigationViewers investigationId="investigation-1" separator="|" />);

    await waitFor(() => expect(heartbeat).toHaveBeenCalled());
    expect(screen.queryByText('|')).not.toBeInTheDocument();
  });
});
