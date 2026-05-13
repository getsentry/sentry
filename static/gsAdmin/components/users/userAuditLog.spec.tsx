import {UserFixture} from 'sentry-fixture/user';

import {AdminAuditLogFixture} from 'getsentry-test/fixtures/adminAuditLog';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {UserAuditLog} from 'admin/components/users/userAuditLog';

describe('UserAuditLog', () => {
  const user = UserFixture();

  function mockAuditLogsEndpoint(rows: Array<ReturnType<typeof AdminAuditLogFixture>>) {
    MockApiClient.addMockResponse({
      url: '/audit-logs/',
      body: {rows, filters: {}},
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders column headers', async () => {
    mockAuditLogsEndpoint([]);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.getByText('Time')).toBeInTheDocument();
    });
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Ticket')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders a suspension log entry', async () => {
    const entry = AdminAuditLogFixture({
      eventType: 'User: Suspend',
      eventCode: 117,
      actor: {email: 'admin@sentry.io', name: 'Admin User'},
      ticketId: 'https://sentry.zendesk.com/tickets/456',
      data: {notes: 'Suspicious activity detected'},
    });

    mockAuditLogsEndpoint([entry]);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.getByText('User: Suspend')).toBeInTheDocument();
    });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Admin User'})).toHaveAttribute(
      'href',
      'mailto:admin@sentry.io'
    );
    expect(screen.getByRole('link', {name: 'Ticket'})).toHaveAttribute(
      'href',
      'https://sentry.zendesk.com/tickets/456'
    );
    expect(screen.getByText('Suspicious activity detected')).toBeInTheDocument();
  });

  it('renders em dash when actor is null', async () => {
    const entry = AdminAuditLogFixture({actor: null});

    mockAuditLogsEndpoint([entry]);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('renders em dash when ticketId is null', async () => {
    const entry = AdminAuditLogFixture({ticketId: null});

    mockAuditLogsEndpoint([entry]);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.queryByRole('link', {name: 'Ticket'})).not.toBeInTheDocument();
    });
  });

  it('renders em dash when notes are absent', async () => {
    const entry = AdminAuditLogFixture({data: {}});

    mockAuditLogsEndpoint([entry]);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('renders multiple entries', async () => {
    const entries = [
      AdminAuditLogFixture({id: '1', eventType: 'User: Suspend', eventCode: 117}),
      AdminAuditLogFixture({id: '2', eventType: 'User: Unsuspend', eventCode: 118}),
    ];

    mockAuditLogsEndpoint(entries);

    render(<UserAuditLog userId={user.id} />);

    await waitFor(() => {
      expect(screen.getByText('User: Suspend')).toBeInTheDocument();
    });
    expect(screen.getByText('User: Unsuspend')).toBeInTheDocument();
  });
});
