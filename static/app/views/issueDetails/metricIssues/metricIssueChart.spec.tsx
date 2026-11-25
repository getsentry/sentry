import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {setMockDate} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {IssueDetailsContext} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {getDetectorDetails} from 'sentry/views/issueDetails/sidebar/detectorSection';

describe('MetricIssueChart', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const group = GroupFixture({
    project,
    issueCategory: IssueCategory.METRIC,
    issueType: IssueType.METRIC_ISSUE,
  });

  const detector = MetricDetectorFixture({projectId: project.id});
  const event = EventFixture({
    id: 'event-1',
    occurrence: {
      evidenceData: {
        detectorId: detector.id,
        dataSources: [SnubaQueryDataSourceFixture()],
      },
      type: 8001,
    },
  });

  const context = {
    sectionData: {},
    detectorDetails: getDetectorDetails({event, organization, project}),
    isSidebarOpen: true,
    navScrollMargin: 0,
    scrollContext: 'page' as const,
    eventCount: 0,
    eventNavigationHeight: 0,
    dispatch: jest.fn(),
  };

  let mockStats: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: detector,
    });
    mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: EventsStatsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [],
    });
  });

  it.each([
    {firstSeen: '2026-01-31T12:00:00Z', statsPeriod: '24h'},
    {firstSeen: '2026-01-31T11:30:00Z', statsPeriod: '2d'},
    {firstSeen: '2026-01-10T12:00:00Z', statsPeriod: '7d'},
  ])(
    'defaults to $statsPeriod for first seen $firstSeen',
    async ({firstSeen, statsPeriod}) => {
      setMockDate(Date.parse('2026-02-01T12:00:00Z'));
      render(
        <IssueDetailsContext value={context}>
          <EventDetailsHeader
            group={{...group, firstSeen}}
            project={project}
            event={event}
          />
        </IssueDetailsContext>,
        {
          organization,
          initialRouterConfig: {
            location: {pathname: '/organizations/org-slug/issues/group-id/'},
          },
        }
      );

      expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: statsPeriod.toUpperCase()})
      ).toBeInTheDocument();
      expect(mockStats).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({query: expect.objectContaining({statsPeriod})})
      );
      const chartQuery = mockStats.mock.lastCall?.[1].query;
      expect(chartQuery).not.toHaveProperty('start');
      expect(chartQuery).not.toHaveProperty('end');
    }
  );

  it('limits metric issue chart range to 10k points and shows a warning', async () => {
    render(
      <IssueDetailsContext value={context}>
        <EventDetailsHeader group={group} project={project} event={event} />
      </IssueDetailsContext>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/group-id/',
            query: {statsPeriod: '30d'},
          },
        },
      }
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The selected time range contains too many data points. Narrow the range to view all data.'
      )
    ).toBeInTheDocument();

    // Expect it to be called with 7d instead of 30d
    expect(mockStats).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: expect.objectContaining({statsPeriod: '168h'})})
    );
  });

  it.each([
    {view: 'issue overview', route: '', path: ''},
    {view: 'single event', route: 'events/:eventId/', path: `events/${event.id}/`},
  ])('uses the zoomed range on the $view', async ({route, path}) => {
    const absoluteRange = {
      start: '2026-01-10T11:00:00.000',
      end: '2026-01-10T13:00:00.000',
    };
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: [],
      datetime: {...absoluteRange, period: null, utc: true},
    });

    render(
      <IssueDetailsContext value={context}>
        <EventDetailsHeader group={group} project={project} event={event} />
      </IssueDetailsContext>,
      {
        organization,
        initialRouterConfig: {
          route: `/organizations/:orgId/issues/:groupId/${route}`,
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/${path}`,
            query: absoluteRange,
          },
        },
      }
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(mockStats).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: expect.objectContaining(absoluteRange)})
    );
  });

  it('reports how many open periods overlap the selected time range', async () => {
    const dispatch = jest.fn();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [],
      headers: {'X-Hits': '2'},
      match: [MockApiClient.matchQuery({statsPeriod: '24h'})],
    });

    render(
      <IssueDetailsContext value={{...context, dispatch}}>
        <EventDetailsHeader group={group} project={project} event={event} />
      </IssueDetailsContext>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/group-id/',
            query: {statsPeriod: '24h'},
          },
        },
      }
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({type: 'UPDATE_EVENT_COUNT', count: 2});
    });
  });

  it('zooms to the open period with one request on an event route', async () => {
    setMockDate(Date.parse('2024-01-10T00:00:00Z'));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [{id: '101', start: '2024-01-01T00:00:00Z', end: '2024-01-01T00:05:00Z'}],
      match: [MockApiClient.matchQuery({eventId: event.id})],
    });

    const {router} = render(
      <IssueDetailsContext value={context}>
        <EventDetailsHeader group={group} project={project} event={event} />
      </IssueDetailsContext>,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/events/${event.id}/`,
          },
        },
      }
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.location.query).toEqual({
        start: '2023-12-31T23:48:00',
        end: '2024-01-01T00:15:00',
      })
    );
    expect(mockStats).toHaveBeenCalledTimes(1);
  });

  it('shows detector load error message when detector request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      statusCode: 404,
    });

    render(
      <IssueDetailsContext value={context}>
        <EventDetailsHeader group={group} project={project} event={event} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(
      await screen.findByText(
        /The metric monitor which created this issue no longer exists./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });
});
