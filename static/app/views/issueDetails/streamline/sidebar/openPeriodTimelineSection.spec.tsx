import type {ComponentProps} from 'react';
import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {OpenPeriodTimelineSection} from 'sentry/views/issueDetails/streamline/sidebar/openPeriodTimelineSection';

describe('OpenPeriodTimelineSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  const defaultProps: ComponentProps<typeof OpenPeriodTimelineSection> = {
    eventId: 'event-2',
    groupId: 'group-1',
  };

  it('renders loading error when open period is missing', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });

    render(<OpenPeriodTimelineSection {...defaultProps} />);

    expect(
      await screen.findByText('Error loading open period timeline')
    ).toBeInTheDocument();
  });

  it('renders open period activities', async () => {
    const openPeriod = GroupOpenPeriodFixture({
      activities: [
        GroupOpenPeriodActivityFixture({
          id: 'activity-1',
          type: 'opened',
          value: 'medium',
          dateCreated: '2024-01-01T00:00:00Z',
          eventId: 'event-1',
        }),
        GroupOpenPeriodActivityFixture({
          id: 'activity-2',
          type: 'status_change',
          value: 'high',
          eventId: 'event-2',
          dateCreated: '2024-01-01T00:02:00Z',
        }),
        GroupOpenPeriodActivityFixture({
          id: 'activity-3',
          type: 'closed',
          value: null,
          dateCreated: '2024-01-01T00:05:00Z',
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [openPeriod],
    });

    render(<OpenPeriodTimelineSection {...defaultProps} />);

    const activityRows = await screen.findAllByTestId('open-period-timeline-row');
    expect(activityRows).toHaveLength(3);
    const resolvedRow = activityRows[0]!;
    const statusChangedRow = activityRows[1]!;
    const openedRow = activityRows[2]!;

    expect(within(resolvedRow).getByText('Resolved')).toBeInTheDocument();

    expect(within(statusChangedRow).getByText(/Status Changed/)).toBeInTheDocument();
    expect(within(statusChangedRow).getByText(/This event/)).toBeInTheDocument();
    expect(within(statusChangedRow).getByText('Priority: high')).toBeInTheDocument();

    expect(within(openedRow).getByText('Opened')).toBeInTheDocument();
    expect(within(openedRow).getByText('Priority: medium')).toBeInTheDocument();
  });
});
