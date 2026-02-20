import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AlertsDebug from 'admin/views/alertsDebug';
import {EventFixture, MOCK_LOGS, MOCK_WORKFLOW} from 'admin/views/alertsDebug/fixtures';

describe('AlertsDebug', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Mock the events endpoint for workflow logs (uses MOCK_WORKFLOW.organizationId)
    MockApiClient.addMockResponse({
      url: `/organizations/${MOCK_WORKFLOW.organizationId}/events/`,
      body: {data: MOCK_LOGS, meta: {fields: {}}},
    });
  });

  it('renders workflow ID input initially', () => {
    render(<AlertsDebug />);

    expect(screen.getByText('Enter Workflow ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Workflow ID')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Load Workflow'})).toBeInTheDocument();
  });

  it('fetches and displays workflow when ID is submitted', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    expect(await screen.findByText(/Workflow: 123/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Change Workflow'})).toBeInTheDocument();
  });

  it('shows event input section after workflow loads', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    expect(await screen.findByText('Add Events to Evaluate')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Event ID (e.g., abc123)')).toBeInTheDocument();
  });

  it('adds and displays event cards when events are added', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/event1/',
      body: EventFixture({eventID: 'event1', title: 'Test Event 1'}),
    });

    render(<AlertsDebug />);

    // Load workflow
    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    // Wait for event input to appear
    const eventInput = await screen.findByPlaceholderText('Event ID (e.g., abc123)');

    // Add an event
    await userEvent.type(eventInput, 'event1');
    await userEvent.click(screen.getByRole('button', {name: 'Add Event'}));

    // Event card should appear
    expect(await screen.findByText('Test Event 1')).toBeInTheDocument();
    expect(screen.getByText('Events to Evaluate:')).toBeInTheDocument();
  });

  it('shows evaluate button when events are added', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/event1/',
      body: EventFixture({eventID: 'event1', title: 'Test Event 1'}),
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    const eventInput = await screen.findByPlaceholderText('Event ID (e.g., abc123)');
    await userEvent.type(eventInput, 'event1');
    await userEvent.click(screen.getByRole('button', {name: 'Add Event'}));

    // Wait for event card to load
    await screen.findByText('Test Event 1');

    expect(screen.getByRole('button', {name: 'Evaluate Events'})).toBeInTheDocument();
  });

  it('shows results inline after clicking evaluate', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/event1/',
      body: EventFixture({eventID: 'event1', title: 'Test Event 1'}),
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    const eventInput = await screen.findByPlaceholderText('Event ID (e.g., abc123)');
    await userEvent.type(eventInput, 'event1');
    await userEvent.click(screen.getByRole('button', {name: 'Add Event'}));

    // Wait for event card to load
    await screen.findByText('Test Event 1');

    // Click evaluate
    await userEvent.click(screen.getByRole('button', {name: 'Evaluate Events'}));

    // Results should appear inline
    expect(await screen.findByText('Evaluation Results')).toBeInTheDocument();
    expect(screen.getByText(/"workflowId": 123/)).toBeInTheDocument();
    expect(screen.getByText(/"event1"/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Clear Results'})).toBeInTheDocument();
  });

  it('clears results when clicking clear button', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/event1/',
      body: EventFixture({eventID: 'event1', title: 'Test Event 1'}),
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    const eventInput = await screen.findByPlaceholderText('Event ID (e.g., abc123)');
    await userEvent.type(eventInput, 'event1');
    await userEvent.click(screen.getByRole('button', {name: 'Add Event'}));

    await screen.findByText('Test Event 1');
    await userEvent.click(screen.getByRole('button', {name: 'Evaluate Events'}));

    await screen.findByText('Evaluation Results');

    // Clear results
    await userEvent.click(screen.getByRole('button', {name: 'Clear Results'}));

    // Results should be gone, evaluate button should return
    expect(screen.queryByText('Evaluation Results')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Evaluate Events'})).toBeInTheDocument();
  });

  it('allows changing workflow after loading', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      body: MOCK_WORKFLOW,
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    await screen.findByText(/Workflow: 123/);

    await userEvent.click(screen.getByRole('button', {name: 'Change Workflow'}));

    // Should be back to workflow input
    expect(screen.getByText('Enter Workflow ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Workflow ID')).toBeInTheDocument();
  });

  it('falls back to mock workflow when API errors', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/workflows/123/',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(<AlertsDebug />);

    await userEvent.type(screen.getByPlaceholderText('Workflow ID'), '123');
    await userEvent.click(screen.getByRole('button', {name: 'Load Workflow'}));

    expect(
      await screen.findByText(/Error loading workflow. Using mock data/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Workflow: 123/)).toBeInTheDocument();
  });
});
