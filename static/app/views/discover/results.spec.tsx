import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import * as PageFilterPersistence from 'sentry/components/pageFilters/persistence';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {SavedSearchType} from 'sentry/types/group';
import {EventView} from 'sentry/utils/discover/eventView';

import {DEFAULT_EVENT_VIEW, getAllViews} from './results/data';
import Results from './results';

const FIELDS = [
  {
    field: 'title',
  },
  {
    field: 'timestamp',
  },
  {
    field: 'user',
  },
  {
    field: 'count()',
  },
];

const generateFields = () => ({
  field: FIELDS.map(i => i.field),
});

const eventTitle = 'Oh no something bad';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects-count/',
    body: {myProjects: 10, allProjects: 300},
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    body: [],
  });

  const eventsStatsMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: {data: [[123, []]]},
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    method: 'POST',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/stats/',
    body: [],
  });

  const eventsResultsMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      meta: {
        fields: {
          id: 'string',
          title: 'string',
          'project.name': 'string',
          timestamp: 'date',
          'user.id': 'string',
        },
        discoverSplitDecision: 'transaction-like',
      },
      data: [
        {
          id: 'deadbeef',
          'user.id': 'alberto leal',
          title: eventTitle,
          'project.name': 'project-slug',
          timestamp: '2019-05-23T22:12:48+00:00',
        },
      ],
    },
  });

  const eventsMetaMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-meta/',
    body: {
      count: 2,
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/project-slug:deadbeef/',
    method: 'GET',
    body: {
      id: '1234',
      size: 1200,
      eventID: 'deadbeef',
      title: 'Oh no something bad',
      message: 'It was not good',
      dateCreated: '2019-05-23T22:12:48+00:00',
      entries: [
        {
          type: 'message',
          message: 'bad stuff',
          data: {},
        },
      ],
      tags: [{key: 'browser', value: 'Firefox'}],
    },
  });

  const eventFacetsMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    body: [
      {
        key: 'release',
        topValues: [{count: 3, value: 'abcd123', name: 'abcd123'}],
      },
      {
        key: 'environment',
        topValues: [
          {count: 2, value: 'dev', name: 'dev'},
          {count: 1, value: 'prod', name: 'prod'},
        ],
      },
      {
        key: 'foo',
        topValues: [
          {count: 2, value: 'bar', name: 'bar'},
          {count: 1, value: 'baz', name: 'baz'},
        ],
      },
    ],
  });

  const mockVisit = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/discover/saved/1/visit/',
    method: 'POST',
    body: [],
    statusCode: 200,
  });

  const mockSaved = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/discover/saved/1/',
    method: 'GET',
    statusCode: 200,
    body: {
      id: '1',
      name: 'new',
      projects: [],
      version: 2,
      expired: false,
      dateCreated: '2021-04-08T17:53:25.195782Z',
      dateUpdated: '2021-04-09T12:13:18.567264Z',
      createdBy: {
        id: '2',
      },
      environment: [],
      fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
      widths: ['-1', '-1', '-1', '-1', '-1'],
      range: '24h',
      orderby: '-user.display',
      queryDataset: 'discover',
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/discover/homepage/',
    method: 'GET',
    statusCode: 200,
    body: {
      id: '2',
      name: '',
      projects: [],
      version: 2,
      expired: false,
      dateCreated: '2021-04-08T17:53:25.195782Z',
      dateUpdated: '2021-04-09T12:13:18.567264Z',
      createdBy: {
        id: '2',
      },
      environment: [],
      fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
      widths: ['-1', '-1', '-1', '-1', '-1'],
      range: '24h',
      orderby: '-user.display',
      queryDataset: 'discover',
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
    method: 'GET',
    statusCode: 204,
    body: '',
  });

  return {
    eventsStatsMock,
    eventsMetaMock,
    eventsResultsMock,
    mockVisit,
    mockSaved,
    eventFacetsMock,
  };
}

describe('Results', () => {
  beforeEach(() => {
    ProjectsStore.reset();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });
  describe('Events', () => {
    const features = ['discover-basic'];
    it('loads data when moving from an invalid to valid EventView', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      // Start with an invalid EventView
      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {query: 'tag:value'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Should redirect and retain the old query value
      expect(await screen.findByText(eventTitle)).toBeInTheDocument();
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/explore/errors/results/`
      );
      expect(router.location.query).toEqual(
        expect.objectContaining({
          query: 'tag:value',
        })
      );

      expect(mockRequests.eventsStatsMock).toHaveBeenCalled();
    });

    it('pagination cursor should be cleared when making a search', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              ...generateFields(),
              cursor: '0%3A50%3A0',
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // ensure cursor query string is initially present in the location
      expect(router.location.query).toEqual(
        expect.objectContaining({
          ...generateFields(),
          cursor: '0%3A50%3A0',
        })
      );

      await waitFor(() =>
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      );

      // perform a search
      await userEvent.click(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      );
      await userEvent.paste('geo:canada');
      await userEvent.keyboard('{enter}');

      // should only be called with saved queries
      expect(mockRequests.mockVisit).not.toHaveBeenCalled();

      // cursor query string should be omitted from the query string
      await waitFor(() => {
        expect(router.location).toEqual(
          expect.objectContaining({
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: expect.objectContaining({
              ...generateFields(),
              query: 'geo:canada',
              statsPeriod: '14d',
            }),
          })
        );
      });
      expect(router.location.query.cursor).toBeUndefined();
    });

    it('replaces page and legacy date params with normalized ones when searching on an absolute range', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              ...generateFields(),
              cursor: '0:50:0',
              start: '2024-01-01T00:00:00',
              end: '2024-01-02T00:00:00',
              pageStart: '2023-01-01T00:00:00',
              pageEnd: '2023-01-02T00:00:00',
              period: '',
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await screen.findByText(eventTitle);
      await userEvent.click(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      );
      await userEvent.paste('geo:canada');
      await userEvent.keyboard('{enter}');

      await waitFor(() => {
        expect(router.location.query.query).toBe('geo:canada');
      });
      expect(router.location.query).toEqual({
        ...generateFields(),
        query: 'geo:canada',
        start: '2024-01-01T00:00:00.000',
        end: '2024-01-02T00:00:00.000',
      });
    });

    it('resets a cleared y-axis to the default when searching', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const {eventsStatsMock} = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Y-Axis count()'}));
      await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
      await screen.findByText('No Y-Axis selected.');
      eventsStatsMock.mockClear();

      await userEvent.click(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      );
      await userEvent.paste('geo:canada');
      await userEvent.keyboard('{enter}');

      await waitFor(() => {
        expect(router.location.query.query).toBe('geo:canada');
      });
      expect(router.location.query.yAxis).toBeUndefined();
      expect(screen.queryByText('No Y-Axis selected.')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({yAxis: ['count()']}),
          })
        );
      });
    });

    it('writes the display to the URL when a display is selected', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await selectEvent.select(
        await screen.findByRole('button', {name: /Display/}),
        'Total Daily'
      );

      await waitFor(() => {
        expect(router.location.query.display).toBe('daily');
      });
      expect(router.location.query.yAxis).toBe('count()');
    });

    it('writes the interval to the URL when an interval is selected', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await selectEvent.select(
        await screen.findByRole('button', {name: /Interval/}),
        '4h'
      );

      await waitFor(() => {
        expect(router.location.query.interval).toBe('4h');
      });
      expect(router.location.query.display).toBe('default');
    });

    it('writes the top events limit to the URL when a limit is selected', async () => {
      const organization = OrganizationFixture({
        features: [...features, 'discover-query'],
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'top5', yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await selectEvent.select(await screen.findByRole('button', {name: /Limit/}), '3');

      await waitFor(() => {
        expect(router.location.query.topEvents).toBe('3');
      });
      expect(router.location.query.display).toBe('top5');
    });

    it('writes the cursor to the URL when the next page is clicked', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        headers: {
          Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/events/?cursor=0:50:0>; rel="next"; results="true"; cursor="0:50:0"',
        },
        body: {
          meta: {fields: {title: 'string'}},
          data: [{id: 'deadbeef', title: eventTitle}],
        },
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

      await waitFor(() => {
        expect(router.location.query.cursor).toBe('0:50:0');
      });
      expect(router.location.query.yAxis).toBe('count()');
    });

    it('renders a y-axis selector', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Click the 'default' option.
      await selectEvent.select(
        await screen.findByRole('button', {name: 'Y-Axis count()'}),
        'count_unique(user)'
      );
    });

    it('renders a display selector', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Click the 'default' option.
      await selectEvent.select(
        await screen.findByRole('button', {name: /Display/}),
        'Total Period'
      );
    });

    it('keeps other params in the URL when a second y-axis is selected', async () => {
      const organization = OrganizationFixture({
        features,
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              ...generateFields(),
              display: 'previous',
              yAxis: 'count()',
              interval: '1h',
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await selectEvent.select(
        await screen.findByRole('button', {name: 'Y-Axis count()'}),
        'count_unique(user)'
      );

      await waitFor(() => {
        expect(router.location.query).toEqual(
          expect.objectContaining({
            display: 'previous',
            interval: '1h',
            yAxis: ['count()', 'count_unique(user)'],
          })
        );
      });
    });

    it.each(['yAxis=', 'yAxis'])(
      'shows no y-axis when the URL has a cleared %p',
      async clearedYAxis => {
        const organization = OrganizationFixture({
          features,
        });

        renderMockRequests();

        ProjectsStore.loadInitialData([ProjectFixture()]);

        const {router} = render(<Results />, {
          initialRouterConfig: {
            location: {
              pathname: `/organizations/${organization.slug}/explore/errors/results/`,
              query: generateFields(),
            },
            route: '/organizations/:orgId/explore/errors/results/',
          },
          organization,
        });

        await screen.findByText(eventTitle);
        const params = new URLSearchParams();
        FIELDS.forEach(f => params.append('field', f.field));
        router.navigate(
          `${router.location.pathname}?${params.toString()}&${clearedYAxis}`
        );

        expect(await screen.findByText('No Y-Axis selected.')).toBeInTheDocument();
      }
    );

    it('excludes top5 options when plan does not include discover-query', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'previous'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(await screen.findByRole('button', {name: /Display/}));

      expect(screen.queryByText('Top 5 Daily')).not.toBeInTheDocument();
      expect(screen.queryByText('Top 5 Period')).not.toBeInTheDocument();
    });

    it('needs confirmation on long queries', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), statsPeriod: '60d', project: '-1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(0);
      await screen.findByText('Errors');
    });

    it('needs confirmation on long query with explicit projects', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              ...generateFields(),
              statsPeriod: '60d',
              project: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(String),
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(0);
      await screen.findByText('Errors');
    });

    it('does not need confirmation on short queries', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), statsPeriod: '30d', project: '-1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => {
        expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(1);
      });
    });

    it('does not need confirmation with too few projects', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              ...generateFields(),
              statsPeriod: '90d',
              project: [1, 2, 3, 4].map(String),
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => {
        expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(1);
      });
    });

    it('creates event view from saved query', async () => {
      const organization = OrganizationFixture({
        features,
        slug: 'org-slug',
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1', statsPeriod: '24h'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => expect(mockRequests.mockVisit).toHaveBeenCalled());

      expect(screen.getByRole('link', {name: 'timestamp'})).toHaveAttribute(
        'href',
        expect.stringContaining('field=timestamp')
      );

      expect(screen.getByRole('link', {name: 'project'})).toHaveAttribute(
        'href',
        expect.stringContaining('field=project')
      );

      // NOTE: This uses a legacy redirect for project event to the issue group event link
      expect(screen.getByRole('link', {name: 'deadbeef'})).toHaveAttribute(
        'href',
        expect.stringContaining('/org-slug/project-slug/events/deadbeef/')
      );

      expect(screen.getByRole('link', {name: 'user.display'})).toHaveAttribute(
        'href',
        expect.stringContaining('field=user.display')
      );

      expect(screen.getByRole('link', {name: 'title'})).toHaveAttribute(
        'href',
        expect.stringContaining('field=title')
      );
    });

    it('overrides saved query params with location query params', async () => {
      const organization = OrganizationFixture({
        features,
        slug: 'org-slug',
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {
              id: '1',
              statsPeriod: '7d',
              project: ['2'],
              environment: ['production'],
            },
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => expect(mockRequests.mockVisit).toHaveBeenCalled());

      expect(screen.getByRole('link', {name: 'timestamp'})).toHaveAttribute(
        'href',
        expect.stringContaining('statsPeriod=7d')
      );
      expect(screen.getByRole('link', {name: 'timestamp'})).toHaveAttribute(
        'href',
        expect.stringContaining('environment=production')
      );
    });

    it('updates chart whenever yAxis parameter changes', async () => {
      const organization = OrganizationFixture({
        features,
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {eventsStatsMock} = renderMockRequests();

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
          }),
        })
      );

      // Update location simulating a yAxis change
      const newParams = new URLSearchParams();
      FIELDS.forEach(f => newParams.append('field', f.field));
      newParams.set('yAxis', 'count_unique(user)');
      router.navigate(`${router.location.pathname}?${newParams.toString()}`);

      // Should load events again with new yAxis
      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledTimes(2);
      });
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count_unique(user)'],
          }),
        })
      );
    });

    it('updates chart whenever display parameter changes', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const {eventsStatsMock} = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
          }),
        })
      );

      // Update location simulating a display change
      const newParams = new URLSearchParams();
      FIELDS.forEach(f => newParams.append('field', f.field));
      newParams.set('display', 'previous');
      newParams.set('yAxis', 'count()');
      router.navigate(`${router.location.pathname}?${newParams.toString()}`);

      // Should load events again with doubled stats period for 'previous' display
      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledTimes(2);
      });
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '28d',
            yAxis: ['count()'],
          }),
        })
      );
    });

    it('updates chart whenever display and yAxis parameters change', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const {eventsStatsMock} = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Should load events once
      expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '14d',
            yAxis: ['count()'],
          }),
        })
      );

      // Update location simulating both display and yAxis changes
      const newParams = new URLSearchParams();
      FIELDS.forEach(f => newParams.append('field', f.field));
      newParams.set('display', 'previous');
      newParams.set('yAxis', 'count_unique(user)');
      router.navigate(`${router.location.pathname}?${newParams.toString()}`);

      // Should load events again with new parameters
      await waitFor(() => {
        expect(eventsStatsMock).toHaveBeenCalledTimes(2);
      });
      expect(eventsStatsMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            statsPeriod: '28d',
            yAxis: ['count_unique(user)'],
          }),
        })
      );
    });

    it('appends tag value to existing query when clicked', async () => {
      const organization = OrganizationFixture({
        features,
      });

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Show Tags'}));

      await waitFor(() => expect(mockRequests.eventFacetsMock).toHaveBeenCalled());

      // TODO(edward): update this to be less generic
      await userEvent.click(screen.getByText('environment'));
      await userEvent.click(screen.getByText('foo'));

      // since environment collides with the environment field, it is wrapped with `tags[...]`
      expect(
        await screen.findByRole('link', {
          name: 'environment, dev, 100% of all events. View events with this tag value.',
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {
          name: 'foo, bar, 100% of all events. View events with this tag value.',
        })
      ).toBeInTheDocument();
    });

    it('respects pinned filters for prebuilt queries', async () => {
      const organization = OrganizationFixture({
        features: [...features],
      });

      renderMockRequests();

      jest.spyOn(PageFilterPersistence, 'getPageFilterStorage').mockReturnValue({
        state: {
          project: [1],
          environment: [],
          start: null,
          end: null,
          period: '14d',
          utc: null,
        },
        pinnedFilters: new Set(['projects']),
      });

      ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'Pinned Project'})]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), display: 'default', yAxis: 'count'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      const projectPageFilter = await screen.findByTestId('page-filter-project-selector');

      expect(projectPageFilter).toHaveTextContent('Pinned Project');
    });

    it('displays tip when events response contains a tip', async () => {
      renderMockRequests();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          meta: {
            fields: {},
            tips: {query: 'this is a tip'},
          },
          data: [],
        },
      });

      const organization = OrganizationFixture({
        features,
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), yAxis: 'count()'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => {
        expect(screen.getByText('this is a tip')).toBeInTheDocument();
      });
    });

    it('renders unparameterized data banner', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {showUnparameterizedBanner: 'true', id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(
        await screen.findByText(/These are unparameterized transactions/)
      ).toBeInTheDocument();
    });

    it('removes the unparameterized banner param from the URL when it is shown', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      renderMockRequests();

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {showUnparameterizedBanner: 'true', id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await screen.findByText(/These are unparameterized transactions/);

      await waitFor(() => {
        expect(router.location.query.showUnparameterizedBanner).toBeUndefined();
      });
      expect(router.location.query.id).toBe('1');
    });

    it('shows the incompatible query banner and removes its param when the URL has incompatible', async () => {
      const organization = OrganizationFixture({
        features,
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      renderMockRequests();

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), incompatible: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(
        await screen.findByText(
          'Your query was updated to make it compatible with this dataset.'
        )
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(router.location.query.incompatible).toBeUndefined();
      });
      expect(router.location.query.field).toEqual(generateFields().field);
    });

    it('updates the homepage query with up to date eventView when Set as Default is clicked', async () => {
      const mockHomepageUpdate = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'PUT',
        statusCode: 200,
      });

      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            // These fields take priority and should be sent in the request
            query: {field: ['title', 'user'], id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Set as Default'})
      );

      expect(mockHomepageUpdate).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/homepage/',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['title', 'user'],
          }),
        })
      );
    });

    it('does not fetch the homepage query when discover-query is disabled', async () => {
      renderMockRequests();
      const mockHomepageGet = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'GET',
        statusCode: 404,
      });

      const organization = OrganizationFixture({
        features: ['discover-basic'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: generateFields(),
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(await screen.findByText(eventTitle)).toBeInTheDocument();
      expect(mockHomepageGet).not.toHaveBeenCalled();
    });

    it('removes a saved query as the default', async () => {
      renderMockRequests();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'PUT',
        statusCode: 200,
        body: {
          id: '2',
          name: '',
          projects: [],
          version: 2,
          expired: false,
          dateCreated: '2021-04-08T17:53:25.195782Z',
          dateUpdated: '2021-04-09T12:13:18.567264Z',
          createdBy: {
            id: '2',
          },
          environment: [],
          fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
          widths: ['-1', '-1', '-1', '-1', '-1'],
          range: '24h',
          orderby: '-user.display',
          queryDataset: 'discover',
        },
      });
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // The saved query matches the homepage, so the context menu offers the
      // "Remove Default" reset action rather than "Set as Default".
      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      expect(
        await screen.findByRole('menuitemradio', {name: 'Remove Default'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Set as Default'})
      ).not.toBeInTheDocument();

      const homepageUrl = `/organizations/${organization.slug}/discover/homepage/`;
      const removeDefault = MockApiClient.addMockResponse({
        url: homepageUrl,
        method: 'DELETE',
        statusCode: 204,
      });
      const emptyHomepage = MockApiClient.addMockResponse({
        url: homepageUrl,
        method: 'GET',
        statusCode: 204,
      });

      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove Default'}));
      await waitFor(() => expect(removeDefault).toHaveBeenCalled());
      await waitFor(() => expect(emptyHomepage).toHaveBeenCalled());
      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      expect(
        await screen.findByRole('menuitemradio', {name: 'Set as Default'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Remove Default'})
      ).not.toBeInTheDocument();
    });

    it('Changes the Use as Discover button to a reset button for prebuilt query', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'PUT',
        statusCode: 200,
        body: {...getAllViews(organization)[0], name: ''},
      });

      const initialQuery = EventView.fromNewQueryWithLocation(
        getAllViews(organization)[0]!,
        LocationFixture()
      ).generateQueryStringObject();

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      const {router} = render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: initialQuery as Record<string, string | string[]>,
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await screen.findAllByText(getAllViews(organization)[0]!.name);
      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Set as Default'})
      );
      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      expect(
        await screen.findByRole('menuitemradio', {name: 'Remove Default'})
      ).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      await userEvent.click(screen.getByText('Total Period'));
      await userEvent.click(screen.getByText('Previous Period'));

      // Navigate to update the display parameter - recreate params with display: previous
      const updatedParams = new URLSearchParams();
      Object.entries(initialQuery).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => updatedParams.append(key, v));
        } else if (value !== null && value !== undefined) {
          updatedParams.set(key, String(value));
        }
      });
      updatedParams.set('display', 'previous');
      router.navigate(`${router.location.pathname}?${updatedParams.toString()}`);

      await screen.findByText('Previous Period');
      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      expect(
        await screen.findByRole('menuitemradio', {name: 'Set as Default'})
      ).toBeInTheDocument();
    });

    it('links back to the homepage through the Discover breadcrumb', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      const discoverCrumb = await screen.findByRole('link', {name: 'Errors'});

      expect(discoverCrumb).toHaveAttribute(
        'href',
        expect.stringMatching(new RegExp('^/organizations/org-slug/explore/errors/'))
      );

      // The query name heads the page, so it is not repeated in the trail.
      expect(screen.getByRole('heading', {name: 'new', level: 1})).toBeInTheDocument();
      expect(
        within(discoverCrumb.closest('ol')!).queryByText('new')
      ).not.toBeInTheDocument();
    });

    it('links back to the Saved Queries through the Saved Queries breadcrumb', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(await screen.findByRole('link', {name: 'Errors'})).toBeInTheDocument();

      expect(screen.getByRole('link', {name: 'Saved Queries'})).toHaveAttribute(
        'href',
        expect.stringMatching(
          new RegExp('^/organizations/org-slug/explore/errors/queries/')
        )
      );
    });

    it('renames the saved query from the page title', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();
      const mockUpdate = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        method: 'PUT',
        statusCode: 200,
        body: {id: '1', name: 'Renamed query'},
      });

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/discover/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/discover/results/',
        },
        organization,
      });

      const heading = await screen.findByRole('heading', {name: 'new', level: 1});
      await userEvent.click(within(heading).getByText('new'));

      const input = screen.getByRole('textbox', {name: 'Edit query name'});
      expect(input).toHaveValue('new');

      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed query{enter}');

      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/saved/1/',
        expect.objectContaining({data: expect.objectContaining({name: 'Renamed query'})})
      );
    });

    it('allows users to Set As Default on the All Events query', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      const initialQuery = EventView.fromNewQueryWithLocation(
        DEFAULT_EVENT_VIEW,
        LocationFixture()
      ).generateQueryStringObject();

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: initialQuery as Record<string, string | string[]>,
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Discover Context Menu'})
      );
      expect(
        await screen.findByRole('menuitemradio', {name: 'Set as Default'})
      ).not.toHaveAttribute('aria-disabled', 'true');
    });

    it("doesn't render sample data alert", async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      const initialQuery = EventView.fromNewQueryWithLocation(
        {...DEFAULT_EVENT_VIEW, query: 'event.type:error'},
        LocationFixture()
      ).generateQueryStringObject();

      ProjectsStore.loadInitialData([ProjectFixture()]);
      renderMockRequests();

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: initialQuery as Record<string, string | string[]>,
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(await screen.findByRole('link', {name: 'Errors'})).toBeInTheDocument();

      expect(screen.queryByText(/Based on your search criteria/)).not.toBeInTheDocument();
    });

    it('calls events endpoint with the right dataset', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      const mockRequests = renderMockRequests();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        method: 'GET',
        statusCode: 200,
        body: {
          id: '1',
          name: 'new',
          projects: [],
          version: 2,
          expired: false,
          dateCreated: '2021-04-08T17:53:25.195782Z',
          dateUpdated: '2021-04-09T12:13:18.567264Z',
          createdBy: {
            id: '2',
          },
          environment: [],
          fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
          widths: ['-1', '-1', '-1', '-1', '-1'],
          range: '24h',
          orderby: '-user.display',
          queryDataset: 'error-events',
        },
      });

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      await waitFor(() => {
        expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(1);
      });

      expect(screen.queryByRole('tab', {name: 'Errors'})).not.toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();

      expect(mockRequests.eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'errors',
          }),
        })
      );

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'errors',
          }),
        })
      );

      expect(mockRequests.eventsMetaMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-meta/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'errors',
          }),
        })
      );
    });

    it('shows the search history for the error dataset', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      ProjectsStore.loadInitialData([ProjectFixture()]);

      renderMockRequests();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        body: [
          {
            query: 'event.type:error',
          },
        ],
        match: [
          (_url, options) => {
            return options.query?.type === SavedSearchType.ERROR;
          },
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        body: [
          {
            query: 'transaction.status:ok',
          },
        ],
        match: [
          (_url, options) => {
            return options.query?.type === SavedSearchType.TRANSACTION;
          },
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        method: 'GET',
        statusCode: 200,
        body: {
          id: '1',
          name: 'new',
          projects: [],
          version: 2,
          expired: false,
          dateCreated: '2021-04-08T17:53:25.195782Z',
          dateUpdated: '2021-04-09T12:13:18.567264Z',
          createdBy: {
            id: '2',
          },
          environment: [],
          fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
          widths: ['-1', '-1', '-1', '-1', '-1'],
          range: '24h',
          orderby: '-user.display',
          queryDataset: 'error-events',
        },
      });

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {id: '1'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      // Wait for data to load
      expect(await screen.findByText(eventTitle)).toBeInTheDocument();

      await userEvent.click(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      );
      expect(
        await screen.findByRole('option', {name: 'event.type:error'})
      ).toBeInTheDocument();
    });
  });

  describe('Save as', () => {
    it('groups saving, monitors and dashboards in one dropdown', async () => {
      const organization = OrganizationFixture({
        features: ['discover-basic', 'discover-query'],
      });

      renderMockRequests();
      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/discover/results/`,
            query: generateFields(),
          },
          route: '/organizations/:orgId/explore/discover/results/',
        },
        organization,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Save as'}));

      expect(screen.getByRole('menuitemradio', {name: 'New Query'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Monitor'})).toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'Dashboard widget'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Create Monitor'})
      ).not.toBeInTheDocument();
    });
  });

  describe('transactions deprecation', () => {
    const features = ['discover-basic'];

    it('blocks the transactions dataset and points users to Explore', async () => {
      const organization = OrganizationFixture({features});

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), queryDataset: 'transaction-like'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      const link = await screen.findByRole('link', {name: 'Explore Queries'});
      expect(link).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/saved-queries/'
      );

      expect(mockRequests.eventsResultsMock).not.toHaveBeenCalled();
      expect(mockRequests.eventsStatsMock).not.toHaveBeenCalled();
      expect(mockRequests.eventsMetaMock).not.toHaveBeenCalled();
    });

    it('still renders the table for the errors dataset', async () => {
      const organization = OrganizationFixture({features});

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([ProjectFixture()]);

      render(<Results />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/errors/results/`,
            query: {...generateFields(), queryDataset: 'error-events'},
          },
          route: '/organizations/:orgId/explore/errors/results/',
        },
        organization,
      });

      expect(await screen.findByText(eventTitle)).toBeInTheDocument();
      expect(mockRequests.eventsResultsMock).toHaveBeenCalled();
      expect(mockRequests.eventsStatsMock).toHaveBeenCalled();
      await waitFor(() => expect(mockRequests.eventsMetaMock).toHaveBeenCalled());
      expect(
        screen.queryByRole('link', {name: 'Explore Queries'})
      ).not.toBeInTheDocument();
    });
  });
});
