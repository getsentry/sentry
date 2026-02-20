import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {WorkflowLogs} from 'admin/views/alertsDebug/components/workflowLogs';
import {
  LogEntryFixture,
  MOCK_GROUPED_LOGS,
  MOCK_LOGS,
} from 'admin/views/alertsDebug/fixtures';

describe('WorkflowLogs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows loading state while fetching', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    expect(screen.getByText(/Loading logs/)).toBeInTheDocument();

    // Wait for the data to load to avoid act warnings
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');
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

  it('does not fetch when workflowId is undefined', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={undefined} organizationId="test-org" />);

    // Should show the heading but no loading state since query is disabled
    expect(screen.getByText('Workflow Logs')).toBeInTheDocument();

    // Wait for any pending state updates to settle
    await waitFor(() => {
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  it('does not fetch when organizationId is undefined', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/undefined/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId={undefined} />);

    // Should show the heading but no loading state since query is disabled
    expect(screen.getByText('Workflow Logs')).toBeInTheDocument();

    // Wait for any pending state updates to settle
    await waitFor(() => {
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  it('renders time range selector and view mode toggle', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for the component to render
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Check that time range selector is rendered (shows 24H by default)
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();

    // Check that view mode toggle is rendered
    expect(screen.getByRole('radio', {name: 'List'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'By Type'})).toBeInTheDocument();
  });

  it('switches to grouped view and displays occurrence counts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for the logs to load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Mock the grouped API response before clicking
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_GROUPED_LOGS, meta: {fields: {}}},
    });

    // Click on the Grouped toggle
    await userEvent.click(screen.getByRole('radio', {name: 'By Type'}));

    // Should show grouped logs with occurrence counts
    await waitFor(() => {
      expect(screen.getByText(/15 occurrences/)).toBeInTheDocument();
    });
    expect(screen.getByText(/8 occurrences/)).toBeInTheDocument();
    expect(screen.getByText(/3 occurrences/)).toBeInTheDocument();
  });

  it('passes groupByMessage parameter when grouped view is selected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for initial load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Set up mock for grouped request
    const groupedRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_GROUPED_LOGS, meta: {fields: {}}},
      match: [
        MockApiClient.matchQuery({
          field: ['message', 'count(message)'],
          sort: '-count_message',
        }),
      ],
    });

    // Click on the Grouped toggle
    await userEvent.click(screen.getByRole('radio', {name: 'By Type'}));

    await waitFor(() => {
      expect(groupedRequest).toHaveBeenCalled();
    });
  });

  it('list view is selected by default and shows individual log entries', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for logs to load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // List should be selected by default
    expect(screen.getByRole('radio', {name: 'List'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'By Type'})).not.toBeChecked();

    // Should show severity tags and timestamps in list view
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('clicking a grouped log switches to list view with filter', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for logs to load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Mock the grouped response before switching
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_GROUPED_LOGS, meta: {fields: {}}},
    });

    // Switch to By Type view
    await userEvent.click(screen.getByRole('radio', {name: 'By Type'}));

    // Wait for grouped logs to load
    await screen.findByText(/15 occurrences/);

    // Mock the filtered list response
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS.slice(0, 1), meta: {fields: {}}},
    });

    // Click on a grouped log row
    const groupedLogRow = screen.getByText(
      'workflow_engine.process_workflows.evaluation.start'
    );
    await userEvent.click(groupedLogRow.closest('[class*="Container"]')!);

    // Should switch to list view
    await waitFor(() => {
      expect(screen.getByRole('radio', {name: 'List'})).toBeChecked();
    });

    // Should show filter indicator with "Show all" button
    expect(screen.getByText(/Filtering by:/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show all'})).toBeInTheDocument();
  });

  it('clicking "Show all" clears the message filter', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for initial load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Mock grouped response
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_GROUPED_LOGS, meta: {fields: {}}},
    });

    // Switch to By Type view
    await userEvent.click(screen.getByRole('radio', {name: 'By Type'}));
    await screen.findByText(/15 occurrences/);

    // Mock filtered list response
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS.slice(0, 1), meta: {fields: {}}},
    });

    // Click on a grouped log row to set filter
    const groupedLogRow = screen.getByText(
      'workflow_engine.process_workflows.evaluation.start'
    );
    await userEvent.click(groupedLogRow.closest('[class*="Container"]')!);

    // Wait for filter to be applied
    await screen.findByRole('button', {name: 'Show all'});

    // Mock the unfiltered response
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });

    // Click "Show all"
    await userEvent.click(screen.getByRole('button', {name: 'Show all'}));

    // Filter indicator should be gone
    await waitFor(() => {
      expect(screen.queryByText(/Filtering by:/)).not.toBeInTheDocument();
    });
  });

  it('renders pagination in list view', async () => {
    const linkHeader =
      '<https://sentry.io/api/0/organizations/test-org/events/?cursor=0:25:0>; rel="next"; results="true"; cursor="0:25:0"';

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: MOCK_LOGS, meta: {fields: {}}},
      headers: {
        Link: linkHeader,
      },
    });

    render(<WorkflowLogs workflowId={123} organizationId="test-org" />);

    // Wait for logs to load
    await screen.findByText('workflow_engine.process_workflows.evaluation.start');

    // Pagination should be rendered
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });
});
