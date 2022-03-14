import ReactEchartsCore from 'echarts-for-react/lib/core';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import WidgetViewerModal from 'sentry/components/modals/widgetViewerModal';
import MemberListStore from 'sentry/stores/memberListStore';
import space from 'sentry/styles/space';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

jest.mock('sentry/components/tooltip', () => {
  return jest.fn(props => {
    return <div>{props.children}</div>;
  });
});

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

function renderModal({initialData: {organization, routerContext}, widget}) {
  return render(
    <div style={{padding: space(4)}}>
      <WidgetViewerModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={organization}
        widget={widget}
        onEdit={() => undefined}
      />
    </div>,
    {
      context: routerContext,
      organization,
    }
  );
}

describe('Modals -> WidgetViewerModal', function () {
  let initialData;
  beforeEach(() => {
    initialData = initializeOrg({
      organization: {
        features: ['discover-query', 'widget-viewer-modal'],
        apdexThreshold: 400,
      },
      router: {
        location: {query: {}},
      },
      project: 1,
      projects: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Discover Area Chart Widget', function () {
    let container, rerender, eventsStatsMock, eventsv2Mock;
    const mockQuery = {
      conditions: 'title:/organizations/:orgId/performance/summary/',
      fields: ['count()', 'failure_count()'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const additionalMockQuery = {
      conditions: '',
      fields: ['count()'],
      id: '2',
      name: 'Another Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Test Widget',
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [mockQuery, additionalMockQuery],
    };

    beforeEach(function () {
      (ReactEchartsCore as jest.Mock).mockClear();
      eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
      eventsv2Mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        body: {
          data: [
            {
              title: '/organizations/:orgId/dashboards/',
              project: 'test-project',
              'user.display': 'test@sentry.io',
              'event.type': 'transaction',
              timestamp: '2022-03-09T00:00:00+00:00',
              id: '1',
              'project.name': 'test-project',
            },
          ],
          meta: {
            title: 'string',
            project: 'string',
            'user.display': 'string',
            'event.type': 'string',
            timestamp: 'date',
            id: 'string',
            'project.name': 'string',
            isMetricsData: false,
          },
        },
      });
      // Forbidden render in beforeEach
      // eslint-disable-next-line
      const modal = renderModal({initialData, widget: mockWidget});
      container = modal.container;
      rerender = modal.rerender;
    });

    it('renders Edit and Open buttons', function () {
      expect(screen.getByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    });

    it('renders default table columns with default orderby', async function () {
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('event.type')).toBeInTheDocument();
      expect(screen.getByText('project')).toBeInTheDocument();
      expect(screen.getByText('user.display')).toBeInTheDocument();
      expect(screen.getByText('timestamp')).toBeInTheDocument();
      expect(screen.getByText('/organizations/:orgId/dashboards/')).toBeInTheDocument();
      expect(screen.getByText('transaction')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('test@sentry.io')).toBeInTheDocument();
      expect(screen.getByText('Mar 9, 2022 12:00:00 AM UTC')).toBeInTheDocument();
      expect(eventsv2Mock).toHaveBeenCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({sort: ['-timestamp']}),
        })
      );
    });

    it('renders area chart', async function () {
      expect(await screen.findByText('echarts mock')).toBeInTheDocument();
    });

    it('renders Discover area chart widget viewer', function () {
      expect(container).toSnapshot();
    });

    it('redirects user to Discover when clicking Open in Discover', async function () {
      expect(
        await screen.findByRole('button', {name: 'Open in Discover'})
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=Test%20Widget&query=title%3A%2Forganizations%2F%3AorgId%2Fperformance%2Fsummary%2F&sort=-timestamp&statsPeriod=14d'
      );
    });

    it('zooms into the selected time range', function () {
      act(() => {
        // Simulate dataZoom event on chart
        (ReactEchartsCore as jest.Mock).mock.calls[0][0].onEvents.datazoom(undefined, {
          getModel: () => {
            return {
              _payload: {
                batch: [{startValue: 1646100000000, endValue: 1646120000000}],
              },
            };
          },
        });
      });
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2022-03-01T02:00:00',
            end: '2022-03-01T07:33:20',
          }),
        })
      );
    });

    it('renders multiquery label and selector', function () {
      expect(
        screen.getByText(
          'This widget was built with multiple queries. Table data can only be displayed for one query at a time.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Query Name')).toBeInTheDocument();
    });

    it('updates selected query when selected in the query dropdown', function () {
      userEvent.click(screen.getByText('Query Name'));
      userEvent.click(screen.getByText('Another Query Name'));
      expect(initialData.router.replace).toHaveBeenCalledWith({
        query: {query: 1},
      });
      // Need to manually set the new router location and rerender to simulate the dropdown selection click
      initialData.router.location.query = {query: ['1']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(screen.getByText('Another Query Name')).toBeInTheDocument();
    });

    it('renders the correct discover query link when there are multiple queries in a widget', function () {
      // Rerender with a different selected query from the default
      initialData.router.location.query = {query: ['1']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=Test%20Widget&query=&sort=-timestamp&statsPeriod=14d'
      );
    });

    it('renders with first legend disabled by default', function () {
      // Rerender with first legend disabled
      initialData.router.location.query = {legend: ['Query Name']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(ReactEchartsCore).toHaveBeenLastCalledWith(
        expect.objectContaining({
          option: expect.objectContaining({
            legend: expect.objectContaining({
              selected: {'Query Name': false},
            }),
          }),
        }),
        {}
      );
    });
  });

  describe('Discover TopN Chart Widget', function () {
    let container, rerender, eventsStatsMock, eventsMock;
    const mockQuery = {
      conditions: 'title:/organizations/:orgId/performance/summary/',
      fields: ['error.type', 'count()'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Test Widget',
      displayType: DisplayType.TOP_N,
      interval: '5m',
      queries: [mockQuery],
    };

    beforeEach(function () {
      eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
      eventsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        match: [MockApiClient.matchQuery({cursor: undefined})],
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
        },
        body: {
          data: [
            {
              'error.type': ['Test Error 1a', 'Test Error 1b', 'Test Error 1c'],
              count: 10,
            },
            {
              'error.type': ['Test Error 2'],
              count: 6,
            },
            {
              'error.type': ['Test Error 3'],
              count: 5,
            },
            {
              'error.type': ['Test Error 4'],
              count: 4,
            },
            {
              'error.type': ['Test Error 5'],
              count: 3,
            },
            {
              'error.type': ['Test Error 6'],
              count: 2,
            },
          ],
          meta: {
            'error.type': 'array',
            count: 'integer',
          },
        },
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        match: [MockApiClient.matchQuery({cursor: '0:10:0'})],
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=0:20:0>; rel="next"; results="true"; cursor="0:20:0"',
        },
        body: {
          data: [
            {
              'error.type': ['Next Page Test Error'],
              count: 1,
            },
          ],
          meta: {
            'error.type': 'array',
            count: 'integer',
          },
        },
      });
      // Forbidden render in beforeEach
      // eslint-disable-next-line
      const modal = renderModal({initialData, widget: mockWidget});
      container = modal.container;
      rerender = modal.rerender;
    });

    it('renders Discover topn chart widget viewer', function () {
      expect(container).toSnapshot();
    });

    it('sorts table when a sortable column header is clicked', function () {
      userEvent.click(screen.getByText('count()'));
      expect(initialData.router.push).toHaveBeenCalledWith({
        query: {sort: ['-count']},
      });
      // Need to manually set the new router location and rerender to simulate the sortable column click
      initialData.router.location.query = {sort: ['-count']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({sort: ['-count']}),
        })
      );
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({orderby: '-count'}),
        })
      );
    });

    it('renders pagination buttons', async function () {
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('paginates to the next page', async function () {
      expect(screen.getByText('Test Error 1c')).toBeInTheDocument();
      userEvent.click(await screen.findByRole('button', {name: 'Next'}));
      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {cursor: '0:10:0'},
        })
      );
      // Need to manually set the new router location and rerender to simulate the next page click
      initialData.router.location.query = {cursor: ['0:10:0']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(await screen.findByText('Next Page Test Error')).toBeInTheDocument();
    });
  });

  describe('Discover World Map Chart Widget', function () {
    let container, eventsMock;
    const mockQuery = {
      conditions: 'title:/organizations/:orgId/performance/summary/',
      fields: ['p75(measurements.lcp)'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Test Widget',
      displayType: DisplayType.WORLD_MAP,
      interval: '5m',
      queries: [mockQuery],
    };

    beforeEach(function () {
      const eventsBody = {
        data: [
          {
            'geo.country_code': 'ES',
            p75_measurements_lcp: 2000,
          },
          {
            'geo.country_code': 'SK',
            p75_measurements_lcp: 3000,
          },
          {
            'geo.country_code': 'CO',
            p75_measurements_lcp: 4000,
          },
        ],
        meta: {
          'geo.country_code': 'string',
          p75_measurements_lcp: 'duration',
        },
      };
      eventsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/eventsv2/',
        body: eventsBody,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-geo/',
        body: eventsBody,
      });
      // Forbidden render in beforeEach
      // eslint-disable-next-line
      container = renderModal({initialData, widget: mockWidget}).container;
    });

    it('always queries geo.country_code in the table chart', async function () {
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/eventsv2/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['geo.country_code', 'p75(measurements.lcp)'],
          }),
        })
      );
      expect(await screen.findByText('geo.country_code')).toBeInTheDocument();
    });

    it('renders Discover topn chart widget viewer', function () {
      expect(container).toSnapshot();
    });
  });

  describe('Issue Table Widget', function () {
    let container, rerender, issuesMock;
    const mockQuery = {
      conditions: 'is:unresolved',
      fields: ['events', 'status', 'title'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      title: 'Issue Widget',
      displayType: DisplayType.TABLE,
      interval: '5m',
      queries: [mockQuery],
      widgetType: WidgetType.ISSUE,
    };
    beforeEach(function () {
      MemberListStore.loadInitialData([]);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'GET',
        match: [
          MockApiClient.matchData({
            cursor: '0:10:0',
          }),
        ],
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/issues/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
            '<http://localhost/api/0/organizations/org-slug/issues/?cursor=0:20:0>; rel="next"; results="true"; cursor="0:20:0"',
        },
        body: [
          {
            id: '2',
            title: 'Another Error: Failed',
            project: {
              id: '3',
            },
            status: 'unresolved',
            lifetime: {count: 5},
            count: 3,
            userCount: 1,
          },
        ],
      });
      issuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'GET',
        match: [
          MockApiClient.matchData({
            cursor: undefined,
          }),
        ],
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/issues/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
            '<http://localhost/api/0/organizations/org-slug/issues/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
        },
        body: [
          {
            id: '1',
            title: 'Error: Failed',
            project: {
              id: '3',
            },
            status: 'unresolved',
            lifetime: {count: 10},
            count: 6,
            userCount: 3,
          },
        ],
      });
      // Forbidden render in beforeEach
      // eslint-disable-next-line
      const modal = renderModal({initialData, widget: mockWidget});
      container = modal.container;
      rerender = modal.rerender;
    });

    it('renders widget title', function () {
      expect(screen.getByText('Issue Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open buttons', function () {
      expect(screen.getByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Issues')).toBeInTheDocument();
    });

    it('renders events, status, and title table columns', async function () {
      expect(await screen.findByText('title')).toBeInTheDocument();
      expect(screen.getByText('Error: Failed')).toBeInTheDocument();
      expect(screen.getByText('events')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('unresolved')).toBeInTheDocument();
    });

    it('renders Issue table widget viewer', function () {
      expect(container).toSnapshot();
    });

    it('redirects user to Issues when clicking Open in Issues', async function () {
      expect(await screen.findByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/?query=is%3Aunresolved&sort=&statsPeriod=14d'
      );
    });

    it('sorts table when a sortable column header is clicked', function () {
      userEvent.click(screen.getByText('events'));
      expect(initialData.router.push).toHaveBeenCalledWith({
        query: {sort: 'freq'},
      });
      // Need to manually set the new router location and rerender to simulate the sortable column click
      initialData.router.location.query = {sort: ['freq']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(issuesMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          data: {
            cursor: undefined,
            display: 'events',
            environment: [],
            expand: ['owners'],
            limit: 20,
            project: [],
            query: 'is:unresolved',
            sort: 'date',
            statsPeriod: '14d',
          },
        })
      );
    });

    it('renders pagination buttons', async function () {
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('paginates to the next page', async function () {
      expect(screen.getByText('Error: Failed')).toBeInTheDocument();
      userEvent.click(await screen.findByRole('button', {name: 'Next'}));
      expect(issuesMock).toHaveBeenCalledTimes(1);
      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {cursor: '0:10:0', page: 1},
        })
      );
      // Need to manually set the new router location and rerender to simulate the next page click
      initialData.router.location.query = {cursor: ['0:10:0']};
      rerender(
        <WidgetViewerModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widget={mockWidget}
          onEdit={() => undefined}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );
      expect(await screen.findByText('Another Error: Failed')).toBeInTheDocument();
    });
  });
});
