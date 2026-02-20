import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {WorkflowLogs} from 'admin/views/alertsDebug/components/workflowLogs';
import {LogEntryFixture, MOCK_LOGS} from 'admin/views/alertsDebug/fixtures';

describe('WorkflowLogs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows loading state while fetching', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    expect(screen.getByText(/Loading logs/)).toBeInTheDocument();
  });

  it('displays logs when loaded successfully', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    expect(
      await screen.findByText('workflow_engine.process_workflows.evaluation.start')
    ).toBeInTheDocument();
    expect(
      screen.getByText('workflow_engine.process_workflows.evaluation.error')
    ).toBeInTheDocument();
    expect(
      screen.getByText('workflow_engine.process_workflows.evaluation.warning')
    ).toBeInTheDocument();
  });

  it('shows empty state when no logs found', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [], meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    expect(
      await screen.findByText(/No logs found for this workflow/)
    ).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    expect(await screen.findByText(/Error loading logs/)).toBeInTheDocument();
  });

  it('displays correct severity tag for error level', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        data: [LogEntryFixture({id: 'log-error', severity: 'error'})],
        meta: {fields: {}},
      },
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    const tag = await screen.findByText('error');
    expect(tag).toBeInTheDocument();
  });

  it('displays correct severity tag for warning level', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        data: [LogEntryFixture({id: 'log-warn', severity: 'warning'})],
        meta: {fields: {}},
      },
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    const tag = await screen.findByText('warning');
    expect(tag).toBeInTheDocument();
  });

  it('displays correct severity tag for info level', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {
        data: [LogEntryFixture({id: 'log-info', severity: 'info'})],
        meta: {fields: {}},
      },
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    const tag = await screen.findByText('info');
    expect(tag).toBeInTheDocument();
  });

  it('expands disclosure to show log details', async () => {
    const logWithDetails = LogEntryFixture({
      id: 'log-details',
      trace: 'trace-xyz789',
      workflow_ids: '456',
      group_id: 'group-abc',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [logWithDetails], meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for logs to load
    const logMessage = await screen.findByText(
      'workflow_engine.process_workflows.evaluation.start'
    );

    // Click the log entry disclosure button (not the outer section disclosure)
    // The log entry button contains the message text
    await userEvent.click(logMessage.closest('button')!);

    // Verify expanded content shows additional fields
    expect(screen.getByText('trace:')).toBeInTheDocument();
    expect(screen.getByText('trace-xyz789')).toBeInTheDocument();
    expect(screen.getByText('workflow_ids:')).toBeInTheDocument();
  });

  it('filters out id/timestamp/message/severity from details', async () => {
    const logEntry = LogEntryFixture({
      id: 'log-filter-test',
      message: 'test message',
      severity: 'info',
      timestamp: '2024-01-15T10:30:00.000Z',
      trace: 'trace-filter-test',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [logEntry], meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    const logMessage = await screen.findByText('test message');

    // Click the log entry disclosure button (not the outer section disclosure)
    await userEvent.click(logMessage.closest('button')!);

    // trace should be shown in details
    expect(screen.getByText('trace:')).toBeInTheDocument();

    // id, timestamp, message, severity should NOT be shown as detail keys
    // (they're already shown in the header or filtered out)
    expect(screen.queryByText('id:')).not.toBeInTheDocument();
    expect(screen.queryByText('timestamp:')).not.toBeInTheDocument();
    expect(screen.queryByText('message:')).not.toBeInTheDocument();
    expect(screen.queryByText('severity:')).not.toBeInTheDocument();
  });

  it('does not fetch when workflowId is undefined', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={undefined} organizationId="test-org" />);

    // Should show the heading but no loading state since query is disabled
    expect(screen.getByText('Workflow Logs')).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not fetch when organizationId is undefined', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/undefined/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId={undefined} />);

    // Should show the heading but no loading state since query is disabled
    expect(screen.getByText('Workflow Logs')).toBeInTheDocument();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
