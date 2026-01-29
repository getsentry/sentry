import type {ComponentProps} from 'react';
import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OpenPeriodTimelineSection} from 'sentry/views/issueDetails/streamline/sidebar/openPeriodTimelineSection';

describe('OpenPeriodTimelineSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  const defaultProps: ComponentProps<typeof OpenPeriodTimelineSection> = {
    eventId: 'event-1',
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
          value: 'high',
          dateCreated: '2024-01-01T00:00:00Z',
        }),
        GroupOpenPeriodActivityFixture({
          id: 'activity-2',
          type: 'status_change',
          value: 'high',
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

    expect(await screen.findByText('Opened')).toBeInTheDocument();
    expect(screen.getByText('Status Changed')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getAllByText('Priority: high')).toHaveLength(2);
  });
});
