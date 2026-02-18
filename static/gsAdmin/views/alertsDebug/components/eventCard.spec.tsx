import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventCard} from 'admin/views/alertsDebug/components/eventCard';
import {EventFixture} from 'admin/views/alertsDebug/fixtures';

describe('EventCard', () => {
  const mockOnRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('shows loading state while fetching', () => {
    // Add mock response so the request doesn't error
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/abc123/',
      body: EventFixture({eventID: 'abc123'}),
    });

    render(<EventCard eventId="abc123" onRemove={mockOnRemove} />);

    // Initially shows loading state
    expect(screen.getByText(/Loading event abc123/)).toBeInTheDocument();
  });

  it('displays event details when loaded successfully', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/abc123/',
      body: EventFixture({
        eventID: 'abc123',
        title: 'Test Error',
        message: 'Something went wrong',
        dateCreated: '2024-01-15T10:30:00.000Z',
        platform: 'python',
      }),
    });

    render(<EventCard eventId="abc123" onRemove={mockOnRemove} />);

    expect(await screen.findByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText(/ID: abc123/)).toBeInTheDocument();
  });

  it('falls back to known mock data when API fails for known event', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/abc123/',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(<EventCard eventId="abc123" onRemove={mockOnRemove} />);

    // Should show mock data with "Mock Data" tag
    expect(await screen.findByText('Mock Data')).toBeInTheDocument();
    expect(screen.getByText(/TypeError: Cannot read property/)).toBeInTheDocument();
  });

  it('falls back to generated mock data when API fails for unknown event', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/unknown-event-id/',
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    render(<EventCard eventId="unknown-event-id" onRemove={mockOnRemove} />);

    // Should show a generated mock event with the eventId
    expect(await screen.findByText('Mock Data')).toBeInTheDocument();
    expect(screen.getByText(/ID: unknown-event-id/)).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked on success state', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/abc123/',
      body: EventFixture({eventID: 'abc123', title: 'Test Event'}),
    });

    render(<EventCard eventId="abc123" onRemove={mockOnRemove} />);

    await userEvent.click(
      await screen.findByRole('button', {name: /Remove event abc123/})
    );
    expect(mockOnRemove).toHaveBeenCalledWith('abc123');
  });

  it('calls onRemove when remove button clicked on mock fallback state', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/_admin/events/abc123/',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(<EventCard eventId="abc123" onRemove={mockOnRemove} />);

    // Wait for mock to appear
    await screen.findByText('Mock Data');

    await userEvent.click(screen.getByRole('button', {name: /Remove event abc123/}));
    expect(mockOnRemove).toHaveBeenCalledWith('abc123');
  });
});
