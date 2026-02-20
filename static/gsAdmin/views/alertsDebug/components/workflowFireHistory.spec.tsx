import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {WorkflowFireHistory} from 'admin/views/alertsDebug/components/workflowFireHistory';
import {
  MOCK_FIRE_HISTORY,
  WorkflowFireHistoryEntryFixture,
} from 'admin/views/alertsDebug/fixtures';

describe('WorkflowFireHistory', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows loading state while fetching', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    expect(screen.getByText(/Loading fire history/)).toBeInTheDocument();

    await screen.findByText('PROJ-1');
  });

  it('displays fire history entries when loaded successfully', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    // Should show group short IDs
    expect(await screen.findByText('PROJ-1')).toBeInTheDocument();
    expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    expect(screen.getByText('PROJ-3')).toBeInTheDocument();
  });

  it('sorts entries by time descending (most recent first)', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    await screen.findByText('PROJ-1');

    // Get all disclosure buttons (header rows) - they should be in descending time order
    const buttons = screen.getAllByRole('button', {name: /PROJ-/});
    expect(buttons[0]).toHaveTextContent('PROJ-1'); // 2024-01-15 (most recent)
    expect(buttons[1]).toHaveTextContent('PROJ-2'); // 2024-01-14
    expect(buttons[2]).toHaveTextContent('PROJ-3'); // 2024-01-13 (oldest)
  });

  it('displays event IDs in header row', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    // Event IDs appear in the header row (may also appear in expanded details)
    expect((await screen.findAllByText('abc123def456')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('def456ghi789').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ghi789jkl012').length).toBeGreaterThan(0);
  });

  it('displays detector name when present', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    await screen.findByText('PROJ-1');

    expect(screen.getByText('Error Rate Detector')).toBeInTheDocument();
  });

  it('shows empty state when no fire history found', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: [],
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    expect(
      await screen.findByText(/No fire history found for this workflow/)
    ).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    expect(await screen.findByText(/Error loading fire history/)).toBeInTheDocument();
  });

  it('does not fetch when workflowId is undefined', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/undefined/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(
      <WorkflowFireHistory workflowId={undefined} organizationIdOrSlug="test-org" />
    );

    expect(screen.getByText('Fire History')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  it('does not fetch when organizationIdOrSlug is undefined', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/undefined/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug={undefined} />);

    expect(screen.getByText('Fire History')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  it('renders time range selector', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    await screen.findByText('PROJ-1');

    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();
  });

  it('renders pagination when Link header is present', async () => {
    const linkHeader =
      '<https://sentry.io/api/0/organizations/test-org/workflows/123/group-history/?cursor=0:25:0>; rel="next"; results="true"; cursor="0:25:0"';

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: MOCK_FIRE_HISTORY,
      headers: {
        Link: linkHeader,
      },
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    await screen.findByText('PROJ-1');

    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('renders single fire history entry correctly', async () => {
    const singleEntry = WorkflowFireHistoryEntryFixture({
      group: {
        id: '42',
        shortId: 'TEST-42',
        title: 'Test Error Title',
      },
      count: 10,
      lastTriggered: '2024-02-20T12:00:00.000Z',
      eventId: 'testevent123',
      detector: {
        id: 1,
        name: 'Test Detector',
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/workflows/123/group-history/',
      body: [singleEntry],
    });

    render(<WorkflowFireHistory workflowId={123} organizationIdOrSlug="test-org" />);

    expect(await screen.findByText('TEST-42')).toBeInTheDocument();
    // Event ID appears in header and expanded details
    expect(screen.getAllByText('testevent123').length).toBeGreaterThan(0);
    expect(screen.getByText('Test Detector')).toBeInTheDocument();
  });
});
