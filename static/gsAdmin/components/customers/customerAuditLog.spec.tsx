import {OrganizationFixture} from 'sentry-fixture/organization';

import {AdminAuditLogFixture} from 'getsentry-test/fixtures/adminAuditLog';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {CustomerAuditLog} from 'admin/components/customers/customerAuditLog';

describe('CustomerAuditLog', () => {
  const org = OrganizationFixture();

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

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getByText('Time')).toBeInTheDocument();
    });
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Ticket')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders a log entry with actor, event type, ticket, and notes', async () => {
    const entry = AdminAuditLogFixture({
      eventType: 'Plan Cancelled',
      actor: {email: 'staff@sentry.io', name: 'Staff User'},
      ticketId: 'https://sentry.zendesk.com/tickets/123',
      data: {notes: 'Cancelled per customer request'},
    });

    mockAuditLogsEndpoint([entry]);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getByText('Plan Cancelled')).toBeInTheDocument();
    });
    expect(screen.getByText('Staff User')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Staff User'})).toHaveAttribute(
      'href',
      'mailto:staff@sentry.io'
    );
    expect(screen.getByRole('link', {name: 'Ticket'})).toHaveAttribute(
      'href',
      'https://sentry.zendesk.com/tickets/123'
    );
    expect(screen.getByText('Cancelled per customer request')).toBeInTheDocument();
  });

  it('falls back to email when actor name is null', async () => {
    const entry = AdminAuditLogFixture({
      actor: {email: 'staff@sentry.io', name: null},
    });

    mockAuditLogsEndpoint([entry]);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getByRole('link', {name: 'staff@sentry.io'})).toHaveAttribute(
        'href',
        'mailto:staff@sentry.io'
      );
    });
  });

  it('renders em dash when actor is null', async () => {
    const entry = AdminAuditLogFixture({actor: null});

    mockAuditLogsEndpoint([entry]);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('renders em dash when ticketId is null', async () => {
    const entry = AdminAuditLogFixture({ticketId: null});

    mockAuditLogsEndpoint([entry]);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.queryByRole('link', {name: 'Ticket'})).not.toBeInTheDocument();
    });
  });

  it('renders em dash when notes are absent', async () => {
    const entry = AdminAuditLogFixture({data: {}});

    mockAuditLogsEndpoint([entry]);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
  });

  it('renders multiple entries', async () => {
    const entries = [
      AdminAuditLogFixture({id: '1', eventType: 'Plan Cancelled'}),
      AdminAuditLogFixture({id: '2', eventType: 'Plan Changed'}),
    ];

    mockAuditLogsEndpoint(entries);

    render(<CustomerAuditLog orgSlug={org.slug} targetId={String(org.id)} />);

    await waitFor(() => {
      expect(screen.getByText('Plan Cancelled')).toBeInTheDocument();
    });
    expect(screen.getByText('Plan Changed')).toBeInTheDocument();
  });
});
