import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, renderHook, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import {useEventColumns} from 'sentry/views/issueDetails/allEventsTable';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';
import {MOCK_EVENTS_TABLE_DATA} from 'sentry/views/performance/transactionSummary/transactionEvents/testUtils';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/components/events/suspectCommits');
jest.mock('sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent');
jest.mock('sentry/views/issueDetails/streamline/issueContent');
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));
const mockUseLocation = jest.mocked(useLocation);

describe('EventList', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture();
  const event = EventFixture({id: 'event-id'});
  const persistantQuery = `issue:${group.shortId}`;
  const totalCount = 100;

  let mockEventList, mockEventListMeta;

  beforeEach(() => {
    mockUseLocation.mockReturnValue(LocationFixture());
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['environments'])
    );
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
      body: {errors: []},
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {'count()': EventsStatsFixture(), 'count_unique(user)': EventsStatsFixture()},
      method: 'GET',
    });
    mockEventList = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: MOCK_EVENTS_TABLE_DATA,
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
    mockEventListMeta = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",` +
          `<http://localhost/api/0/organizations/${organization.slug}/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"`,
      },
      body: {
        data: [{'count()': totalCount}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });
  });

  async function renderAndSwitchToAllEvents() {
    render(<EventDetails event={event} group={group} project={project} />, {
      organization,
      router: RouterFixture({location: LocationFixture()}),
    });
    await screen.findByText(event.id);
    await userEvent.click(screen.getByRole('button', {name: 'View All Events'}));
  }

  it('renders the list using a discover event query', async function () {
    await renderAndSwitchToAllEvents();
    const {result} = renderHook(() => useEventColumns(group, organization));

    expect(mockEventList).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: {
          dataset: 'errors',
          environment: [],
          field: result.current.fields,
          per_page: 50,
          project: [project.id],
          query: persistantQuery,
          referrer: 'issue_details.streamline_list',
          statsPeriod: '14d',
        },
      })
    );
    expect(mockEventListMeta).toHaveBeenCalled();

    expect(screen.getByText('All Events')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(
      screen.getByText(`Showing 0-${MOCK_EVENTS_TABLE_DATA.length} of ${totalCount}`)
    ).toBeInTheDocument();

    // Returns minidump column, but we omit it as a custom column
    const columns = result.current.columnTitles.filter(t => t !== 'minidump');
    for (const title of columns) {
      expect(screen.getByRole('columnheader', {name: title})).toBeInTheDocument();
    }
  });

  it('allows filtering by environment', async function () {
    await renderAndSwitchToAllEvents();

    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
    await userEvent.click(screen.getByRole('row', {name: 'production'}));

    const expectedArgs = [
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['production'],
        }),
      }),
    ];
    expect(mockEventList).toHaveBeenCalledWith(...expectedArgs);
    expect(mockEventListMeta).toHaveBeenCalledWith(...expectedArgs);
  });

  it('updates query from location param change', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const locationQuery = {
      query: {
        query: `${tagKey}:${tagValue}`,
      },
    };
    mockUseLocation.mockReset();
    mockUseLocation.mockReturnValue(LocationFixture(locationQuery));

    await renderAndSwitchToAllEvents();

    const expectedArgs = [
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: [persistantQuery, locationQuery.query.query].join(' '),
        }),
      }),
    ];
    expect(mockEventList).toHaveBeenCalledWith(...expectedArgs);
    expect(mockEventListMeta).toHaveBeenCalledWith(...expectedArgs);
  });

  it('allows filtering by date', async function () {
    await renderAndSwitchToAllEvents();

    await userEvent.click(screen.getByRole('button', {name: '14D'}));
    await userEvent.click(screen.getByRole('option', {name: 'Last 7 days'}));

    const expectedArgs = [
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      }),
    ];
    expect(mockEventList).toHaveBeenCalledWith(...expectedArgs);
    expect(mockEventListMeta).toHaveBeenCalledWith(...expectedArgs);
  });
});
