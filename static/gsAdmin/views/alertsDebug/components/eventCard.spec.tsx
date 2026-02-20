import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventCard} from 'admin/views/alertsDebug/components/eventCard';

describe('EventCard', () => {
  const mockOnRemove = jest.fn();
  const mockOrganizationId = 'test-org';

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('shows loading state while fetching', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      body: {
        data: [
          {
            id: 'abc123',
            title: 'Test Error',
            message: 'Something went wrong',
            platform: 'python',
            timestamp: '2024-01-15T10:30:00.000Z',
          },
        ],
      },
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText(/Loading event abc123/)).toBeInTheDocument();
  });

  it('displays event details when loaded successfully', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      body: {
        data: [
          {
            id: 'abc123',
            title: 'Test Error',
            message: 'Something went wrong',
            platform: 'python',
            timestamp: '2024-01-15T10:30:00.000Z',
          },
        ],
      },
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    expect(await screen.findByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    expect(await screen.findByText(/Error loading event abc123/)).toBeInTheDocument();
  });

  it('shows error state when event not found', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    render(
      <EventCard
        eventId="unknown-event-id"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    expect(
      await screen.findByText(/Error loading event unknown-event-id/)
    ).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked on success state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      body: {
        data: [
          {
            id: 'abc123',
            title: 'Test Event',
            timestamp: '2024-01-15T10:30:00.000Z',
          },
        ],
      },
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: /Remove event abc123/})
    );
    expect(mockOnRemove).toHaveBeenCalledWith('abc123');
  });

  it('calls onRemove when remove button clicked on error state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    // Wait for error to appear
    await screen.findByText(/Error loading event abc123/);

    await userEvent.click(screen.getByRole('button', {name: /Remove event abc123/}));
    expect(mockOnRemove).toHaveBeenCalledWith('abc123');
  });

  it('expands to show details when clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganizationId}/events/`,
      body: {
        data: [
          {
            id: 'abc123',
            title: 'Test Error',
            message: 'Something went wrong',
            platform: 'python',
            timestamp: '2024-01-15T10:30:00.000Z',
          },
        ],
      },
    });

    render(
      <EventCard
        eventId="abc123"
        organizationId={mockOrganizationId}
        onRemove={mockOnRemove}
      />
    );

    // Wait for event to load
    await screen.findByText('Test Error');

    // Click to expand - the disclosure title contains the event info
    await userEvent.click(screen.getByText('Test Error'));

    // After expanding, we should see the event ID
    expect(await screen.findByText(/ID: abc123/)).toBeInTheDocument();
  });
});
