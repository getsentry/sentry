import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within, type RouterConfig} from 'sentry-test/reactTestingLibrary';

import {getShortEventId} from 'sentry/utils/events';
import GroupOpenPeriods from 'sentry/views/issueDetails/groupOpenPeriods';

describe('GroupOpenPeriods', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const groupId = '123';
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${groupId}/open-periods/`,
    },
    route: '/organizations/:orgId/issues/:groupId/open-periods/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders open period activity rows', async () => {
    const statusChangeEventId = 'event-2';
    const openedEventId = 'event-1';
    const openPeriod = GroupOpenPeriodFixture({
      id: 'open-period-1',
      activities: [
        GroupOpenPeriodActivityFixture({
          id: 'activity-1',
          type: 'opened',
          value: 'medium',
          dateCreated: '2024-01-01T00:00:00Z',
          eventId: openedEventId,
        }),
        GroupOpenPeriodActivityFixture({
          id: 'activity-2',
          type: 'status_change',
          value: 'high',
          dateCreated: '2024-01-01T00:02:00Z',
          eventId: statusChangeEventId,
        }),
        GroupOpenPeriodActivityFixture({
          id: 'activity-3',
          type: 'closed',
          value: null,
          dateCreated: '2024-01-01T00:03:00Z',
          eventId: null,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [openPeriod],
      match: [MockApiClient.matchQuery({groupId, per_page: 10})],
    });

    render(<GroupOpenPeriods />, {organization, initialRouterConfig});

    expect(await screen.findByText('All Open Periods')).toBeInTheDocument();
    for (const column of ['Open Period', 'Event ID', 'Description', 'Start', 'End']) {
      expect(screen.getByText(column)).toBeInTheDocument();
    }

    const rows = screen.getAllByTestId('grid-body-row');

    // There should be 2 rows: the first is the status changeevent , the second is the period open event
    expect(rows).toHaveLength(2);
    const [statusRow, openedRow] = rows as [HTMLElement, HTMLElement];

    expect(within(statusRow).getByText('Priority updated to high')).toBeInTheDocument();
    expect(within(statusRow).queryByText('#open-period-1')).not.toBeInTheDocument();
    expect(
      within(statusRow).getByRole('link', {name: getShortEventId(statusChangeEventId)})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${groupId}/events/${statusChangeEventId}/`
    );

    expect(within(openedRow).getByText('#open-period-1')).toBeInTheDocument();
    expect(within(openedRow).getByText('Issue regressed')).toBeInTheDocument();
    expect(
      within(openedRow).getByRole('link', {name: getShortEventId(openedEventId)})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${groupId}/events/${openedEventId}/`
    );

    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 matching open periods')).toBeInTheDocument();
  });
});
