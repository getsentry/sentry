import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as PageFilterPersistence from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import Results from 'sentry/views/eventsV2/results';

import {DEFAULT_EVENT_VIEW, TRANSACTION_VIEWS} from './data';

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
        topValues: [{count: 2, value: 'dev', name: 'dev'}],
      },
      {
        key: 'foo',
        topValues: [{count: 1, value: 'bar', name: 'bar'}],
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
    },
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

describe('Results', function () {
  describe('Events', function () {
    const features = ['discover-basic', 'discover-frontend-use-events-endpoint'];
    it('loads data when moving from an invalid to valid EventView', function () {
      const organization = TestStubs.Organization({
        features,
      });

      // Start off with an invalid view (empty is invalid)
      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {query: 'tag:value'}},
        },
      });

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      // No request as eventview was invalid.
      expect(mockRequests.eventsStatsMock).not.toHaveBeenCalled();

      // Should redirect and retain the old query value
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/discover/results/',
          query: expect.objectContaining({
            query: 'tag:value',
          }),
        })
      );
    });

    it('pagination cursor should be cleared when making a search', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            query: {
              ...generateFields(),
              cursor: '0%3A50%3A0',
            },
          },
        },
      });

      const mockRequests = renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      // ensure cursor query string is initially present in the location
      expect(initialData.router.location).toEqual({
        query: {
          ...generateFields(),
          cursor: '0%3A50%3A0',
        },
      });

      await waitFor(() =>
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      );

      // perform a search
      userEvent.type(
        screen.getByPlaceholderText('Search for events, users, tags, and more'),
        'geo:canada{enter}'
      );

      // should only be called with saved queries
      expect(mockRequests.mockVisit).not.toHaveBeenCalled();

      // cursor query string should be omitted from the query string
      expect(initialData.router.push).toHaveBeenCalledWith({
        pathname: undefined,
        query: {
          ...generateFields(),
          query: 'geo:canada',
          statsPeriod: '14d',
        },
      });
    });

    it('renders a y-axis selector', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      // Click the 'default' option.
      await selectEvent.select(
        await screen.findByRole('button', {name: 'Y-Axis count()'}),
        'count_unique(user)'
      );
    });

    it('renders a display selector', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      // Click the 'default' option.
      await selectEvent.select(
        await screen.findByRole('button', {name: /Display/}),
        'Total Period'
      );
    });

    it('excludes top5 options when plan does not include discover-query', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'previous'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      userEvent.click(await screen.findByRole('button', {name: /Display/}));

      expect(screen.queryByText('Top 5 Daily')).not.toBeInTheDocument();
      expect(screen.queryByText('Top 5 Period')).not.toBeInTheDocument();
    });

    it('needs confirmation on long queries', function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '60d', project: '-1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(0);
    });

    it('needs confirmation on long query with explicit projects', function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            query: {
              ...generateFields(),
              statsPeriod: '60d',
              project: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(0);
    });

    it('does not need confirmation on short queries', function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), statsPeriod: '30d', project: '-1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(1);
    });

    it('does not need confirmation with to few projects', function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            query: {...generateFields(), statsPeriod: '90d', project: [1, 2, 3, 4]},
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(mockRequests.eventsResultsMock).toHaveBeenCalledTimes(1);
    });

    it('creates event view from saved query', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {id: '1', statsPeriod: '24h'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      await waitFor(() => expect(mockRequests.mockVisit).toHaveBeenCalled());

      expect(screen.getByRole('link', {name: 'timestamp'})).toHaveAttribute(
        'href',
        'undefined?field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&query=&sort=-timestamp&statsPeriod=24h&topEvents=5'
      );

      expect(screen.getByRole('link', {name: 'project'})).toHaveAttribute(
        'href',
        'undefined?field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&query=&sort=-project&statsPeriod=24h&topEvents=5'
      );

      expect(screen.getByRole('link', {name: 'deadbeef'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/discover/project-slug:deadbeef/?field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&query=&sort=-user.display&statsPeriod=24h&topEvents=5&yAxis=count%28%29'
      );

      expect(screen.getByRole('link', {name: 'user.display'})).toHaveAttribute(
        'href',
        'undefined?field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&query=&sort=user.display&statsPeriod=24h&topEvents=5'
      );

      expect(screen.getByRole('link', {name: 'title'})).toHaveAttribute(
        'href',
        'undefined?field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&query=&sort=-title&statsPeriod=24h&topEvents=5'
      );
    });

    it('overrides saved query params with location query params', async function () {
      const organization = TestStubs.Organization({
        features,
        slug: 'org-slug',
      });
      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            query: {
              id: '1',
              statsPeriod: '7d',
              project: [2],
              environment: ['production'],
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const mockRequests = renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      await waitFor(() => expect(mockRequests.mockVisit).toHaveBeenCalled());

      expect(screen.getByRole('link', {name: 'timestamp'})).toHaveAttribute(
        'href',
        'undefined?environment=production&field=title&field=event.type&field=project&field=user.display&field=timestamp&id=1&name=new&project=2&query=&sort=-timestamp&statsPeriod=7d&topEvents=5'
      );
    });

    it('updates chart whenever yAxis parameter changes', function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const {eventsStatsMock} = renderMockRequests();

      const {rerender} = render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

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

      // Update location simulating a browser back button action
      rerender(
        <Results
          organization={organization}
          location={{
            ...initialData.router.location,
            query: {...generateFields(), yAxis: 'count_unique(user)'},
          }}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />
      );

      // Should load events again
      expect(eventsStatsMock).toHaveBeenCalledTimes(2);
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

    it('updates chart whenever display parameter changes', function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      const {eventsStatsMock} = renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const {rerender} = render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

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

      // Update location simulating a browser back button action
      rerender(
        <Results
          organization={organization}
          location={{
            ...initialData.router.location,
            query: {...generateFields(), display: 'previous', yAxis: 'count()'},
          }}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />
      );

      // Should load events again
      expect(eventsStatsMock).toHaveBeenCalledTimes(2);
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

    it('updates chart whenever display and yAxis parameters change', function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count()'}},
        },
      });

      const {eventsStatsMock} = renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const {rerender} = render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

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

      // Update location simulating a browser back button action
      rerender(
        <Results
          organization={organization}
          location={{
            ...initialData.router.location,
            query: {
              ...generateFields(),
              display: 'previous',
              yAxis: 'count_unique(user)',
            },
          }}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />
      );

      // Should load events again
      expect(eventsStatsMock).toHaveBeenCalledTimes(2);
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

    it('appends tag value to existing query when clicked', async function () {
      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
      });

      renderMockRequests();

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      userEvent.click(await screen.findByRole('button', {name: 'Show Tags'}));

      // since environment collides with the environment field, it is wrapped with `tags[...]`
      expect(
        await screen.findByRole('link', {
          name: 'Add the environment dev segment tag to the search query',
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {
          name: 'Add the foo bar segment tag to the search query',
        })
      ).toBeInTheDocument();
    });

    it('respects pinned filters for prebuilt queries', async function () {
      const organization = TestStubs.Organization({
        features: [...features, 'global-views', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), display: 'default', yAxis: 'count'}},
        },
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

      ProjectsStore.loadInitialData([TestStubs.Project({id: 1, slug: 'Pinned Project'})]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      const projectPageFilter = await screen.findByTestId('page-filter-project-selector');

      expect(projectPageFilter).toHaveTextContent('Pinned Project');
    });

    it('displays tip when events response contains a tip', async function () {
      renderMockRequests();

      const eventsResultsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          meta: {
            fields: {},
            tips: {query: 'this is a tip'},
          },
          data: [],
        },
      });

      const organization = TestStubs.Organization({
        features,
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...generateFields(), yAxis: 'count()'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      await waitFor(() => {
        expect(eventsResultsMock).toHaveBeenCalled();
      });

      expect(screen.getByText('this is a tip')).toBeInTheDocument();
    });

    it('renders metric fallback alert', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {fromMetric: true, id: '1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(
        await screen.findByText(
          /You've navigated to this page from a performance metric widget generated from processed events/
        )
      ).toBeInTheDocument();
    });

    it('renders unparameterized data banner', async function () {
      const organization = TestStubs.Organization({
        features: ['discover-basic', 'discover-frontend-use-events-endpoint'],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {showUnparameterizedBanner: true, id: '1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      renderMockRequests();

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {
          context: initialData.routerContext,
          organization,
        }
      );

      expect(
        await screen.findByText(/These are unparameterized transactions/)
      ).toBeInTheDocument();
    });

    it('updates the homepage query with up to date eventView when Set as Default is clicked', async () => {
      const mockHomepageUpdate = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'PUT',
        statusCode: 200,
      });

      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          // These fields take priority and should be sent in the request
          location: {query: {field: ['title', 'user'], id: '1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      await waitFor(() =>
        expect(screen.getByRole('button', {name: /set as default/i})).toBeEnabled()
      );
      userEvent.click(screen.getByText('Set as Default'));

      expect(mockHomepageUpdate).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/homepage/',
        expect.objectContaining({
          data: expect.objectContaining({
            fields: ['title', 'user'],
          }),
        })
      );
    });

    it('Changes the Use as Discover button to a reset button for saved query', async () => {
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
          range: '14d',
          orderby: '-user.display',
        },
      });
      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {id: '1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const {rerender} = render(
        <Results
          loading={false}
          setSavedQuery={jest.fn()}
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
        />,
        {context: initialData.routerContext, organization}
      );

      await waitFor(() =>
        expect(screen.getByRole('button', {name: /set as default/i})).toBeEnabled()
      );
      userEvent.click(screen.getByText('Set as Default'));
      expect(await screen.findByText('Remove Default')).toBeInTheDocument();

      userEvent.click(screen.getByText('Total Period'));
      userEvent.click(screen.getByText('Previous Period'));

      const rerenderData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...initialData.router.location.query, display: 'previous'}},
        },
      });

      rerender(
        <Results
          loading={false}
          setSavedQuery={jest.fn()}
          organization={organization}
          location={rerenderData.router.location}
          router={rerenderData.router}
        />
      );
      screen.getByText('Previous Period');
      expect(await screen.findByText('Set as Default')).toBeInTheDocument();
    });

    it('Changes the Use as Discover button to a reset button for prebuilt query', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/homepage/',
        method: 'PUT',
        statusCode: 200,
        body: {...TRANSACTION_VIEWS[0], name: ''},
      });
      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              ...EventView.fromNewQueryWithLocation(
                TRANSACTION_VIEWS[0],
                TestStubs.location()
              ).generateQueryStringObject(),
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      const {rerender} = render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      await screen.findAllByText(TRANSACTION_VIEWS[0].name);
      userEvent.click(screen.getByText('Set as Default'));
      expect(await screen.findByText('Remove Default')).toBeInTheDocument();

      userEvent.click(screen.getByText('Total Period'));
      userEvent.click(screen.getByText('Previous Period'));
      const rerenderData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {...initialData.router.location.query, display: 'previous'}},
        },
      });

      rerender(
        <Results
          organization={organization}
          location={rerenderData.router.location}
          router={rerenderData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />
      );
      screen.getByText('Previous Period');
      expect(await screen.findByText('Set as Default')).toBeInTheDocument();
    });

    it('links back to the homepage through the Discover breadcrumb', () => {
      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {id: '1'}},
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      expect(screen.getByText('Discover')).toHaveAttribute(
        'href',
        expect.stringMatching(new RegExp('^/organizations/org-slug/discover/homepage/'))
      );
    });

    it('links back to the Saved Queries through the Saved Queries breadcrumb', () => {
      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {query: {id: '1'}},
        },
      });

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      expect(screen.getByRole('link', {name: 'Saved Queries'})).toHaveAttribute(
        'href',
        expect.stringMatching(new RegExp('^/organizations/org-slug/discover/queries/'))
      );
    });

    it('allows users to Set As Default on the All Events query', () => {
      const organization = TestStubs.Organization({
        features: [
          'discover-basic',
          'discover-query',
          'discover-query-builder-as-landing-page',
          'discover-frontend-use-events-endpoint',
        ],
      });

      const initialData = initializeOrg({
        ...initializeOrg(),
        organization,
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              ...EventView.fromNewQueryWithLocation(
                DEFAULT_EVENT_VIEW,
                TestStubs.location()
              ).generateQueryStringObject(),
            },
          },
        },
      });

      ProjectsStore.loadInitialData([TestStubs.Project()]);

      render(
        <Results
          organization={organization}
          location={initialData.router.location}
          router={initialData.router}
          loading={false}
          setSavedQuery={jest.fn()}
        />,
        {context: initialData.routerContext, organization}
      );

      expect(screen.getByTestId('set-as-default')).toBeEnabled();
    });
  });
});
