import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, renderHook, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useEventColumns} from 'sentry/views/issueDetails/allEventsTable';
import {MOCK_EVENTS_TABLE_DATA} from 'sentry/views/performance/transactionSummary/transactionEvents/testUtils';

import {EventList} from './eventList';

describe('EventList', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'development'],
  });
  const group = GroupFixture();
  const persistantQuery = `issue:${group.shortId}`;
  const totalCount = 100;

  let mockEventList: jest.Mock;
  let mockEventListMeta: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
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

  function renderAllEvents() {
    render(<EventList group={group} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
        }),
        routes: [{name: '', path: 'events/'}],
      }),
    });
  }

  it('renders the list using a discover event query', async function () {
    renderAllEvents();
    const {result} = renderHook(() => useEventColumns(group, organization));

    expect(await screen.findByText('All Events')).toBeInTheDocument();

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
          sort: '-timestamp',
        },
      })
    );
    expect(mockEventListMeta).toHaveBeenCalled();

    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();
    expect(
      await screen.findByText(
        `Showing 1-${MOCK_EVENTS_TABLE_DATA.length} of ${totalCount} matching events`
      )
    ).toBeInTheDocument();

    // Returns minidump column, but we omit it as a custom column
    const columns = result.current.columnTitles.filter(t => t !== 'Minidump');
    for (const title of columns) {
      expect(screen.getByRole('columnheader', {name: title})).toBeInTheDocument();
    }
  });

  it('updates query from location param change', async function () {
    const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
    const locationQuery = {
      query: {
        query: `${tagKey}:${tagValue}`,
      },
    };
    render(<EventList group={group} />, {
      organization,
      router: RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
          query: locationQuery.query,
        }),
        routes: [{name: '', path: 'events/'}],
      }),
    });

    const expectedArgs = [
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: [persistantQuery, locationQuery.query.query].join(' '),
        }),
      }),
    ];
    await waitFor(() => {
      expect(mockEventList).toHaveBeenCalledWith(...expectedArgs);
    });
    expect(mockEventListMeta).toHaveBeenCalledWith(...expectedArgs);
  });
});
