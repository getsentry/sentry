import ReactEchartsCore from 'echarts-for-react/lib/core';
import type {Location} from 'history';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {MetricsTotalCountByReleaseIn24h} from 'sentry-fixture/metrics';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {WidgetFixture} from 'sentry-fixture/widget';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import WidgetViewerModal from 'sentry/components/modals/widgetViewerModal';
import MemberListStore from 'sentry/stores/memberListStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {performanceScoreTooltip} from 'sentry/views/dashboards/utils';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

type LocationConfig = NonNullable<RouterConfig['location']>;
type InitialData = {
  initialRouterConfig: RouterConfig & {location: LocationConfig};
  organization: ReturnType<typeof OrganizationFixture>;
  projects: Array<ReturnType<typeof ProjectFixture>>;
};

const defaultInitialRouterConfig: RouterConfig & {location: LocationConfig} = {
  location: {
    pathname: '/mock-pathname/',
    query: {},
  },
};

let eventsMetaMock: jest.Mock;

const waitForMetaToHaveBeenCalled = async () => {
  await waitFor(() => {
    expect(eventsMetaMock).toHaveBeenCalled();
  });
};

async function renderModal({
  initialData: {organization, initialRouterConfig},
  widget,
  seriesData,
  tableData,
  pageLinks,
  seriesResultsType,
  dashboardFilters,
}: {
  initialData: InitialData;
  widget: any;
  dashboardFilters?: DashboardFilters;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
}) {
  const routerLocation: LocationConfig = initialRouterConfig.location;
  const routerConfig: RouterConfig = {
    ...initialRouterConfig,
    location: routerLocation,
  };
  const widgetLegendLocation: Location = {
    ...routerLocation,
    hash: '',
    search: '',
    state: undefined,
    key: 'initial',
  } as Location;
  const widgetLegendState = new WidgetLegendSelectionState({
    location: widgetLegendLocation,
    dashboard: DashboardFixture([widget], {id: 'new', title: 'Dashboard'}),
    organization,
    navigate: jest.fn(),
  });
  const rendered = render(
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
        seriesData={seriesData}
        tableData={tableData}
        pageLinks={pageLinks}
        seriesResultsType={seriesResultsType}
        dashboardFilters={dashboardFilters}
        widgetLegendState={widgetLegendState}
      />
    </div>,
    {
      organization,
      initialRouterConfig: routerConfig,
    }
  );
  // Need to wait since WidgetViewerModal will make a request to events-meta
  // for total events count on mount
  if (widget.widgetType === WidgetType.DISCOVER) {
    await waitForMetaToHaveBeenCalled();
  }
  // Component renders twice
  await act(tick);
  return rendered;
}

describe('Modals -> WidgetViewerModal', () => {
  let initialData: InitialData;
  let initialDataWithFlag: InitialData;
  beforeEach(() => {
    const projects = [ProjectFixture()];
    const organization = OrganizationFixture({
      features: ['discover-query'],
    });

    initialData = {
      organization,
      projects,
      initialRouterConfig: {
        ...defaultInitialRouterConfig,
        location: {...defaultInitialRouterConfig.location},
      },
    };

    initialDataWithFlag = {
      organization: OrganizationFixture({
        features: [...organization.features],
      }),
      projects,
      initialRouterConfig: {
        ...defaultInitialRouterConfig,
        location: {...defaultInitialRouterConfig.location},
      },
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    eventsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 33323612},
    });

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1, 2],
      environments: ['prod', 'dev'],
      datetime: {start: null, end: null, period: '24h', utc: null},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  describe('Discover Widgets', () => {
    describe('Area Chart Widget', () => {
      let mockQuery: WidgetQuery;
      let additionalMockQuery: WidgetQuery;
      let mockWidget: Widget;

      function mockEvents() {
        return MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          body: {
            data: [
              {
                title: '/organizations/:orgId/dashboards/',
                id: '1',
                count: 1,
              },
            ],
            meta: {
              fields: {
                title: 'string',
                id: 'string',
                count: 1,
              },
              isMetricsData: false,
            },
          },
        });
      }

      beforeEach(() => {
        mockQuery = {
          conditions: 'title:/organizations/:orgId/insights/summary/',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          name: 'Query Name',
          orderby: '',
        };
        additionalMockQuery = {
          conditions: '',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          name: 'Another Query Name',
          orderby: '',
        };
        mockWidget = {
          id: '1',
          title: 'Test Widget',
          displayType: DisplayType.AREA,
          interval: '5m',
          queries: [mockQuery, additionalMockQuery],
          widgetType: WidgetType.DISCOVER,
        };
        (ReactEchartsCore as jest.Mock).mockClear();
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          body: {
            data: [
              [[1646100000], [{count: 1}]],
              [[1646120000], [{count: 1}]],
            ],
            start: 1646100000,
            end: 1646120000,
            isMetricsData: false,
          },
        });
      });

      it('renders Edit and Open buttons', async () => {
        mockEvents();
        await renderModal({
          initialData,
          widget: {...mockWidget, widgetType: WidgetType.ERRORS},
        });
        expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
        expect(screen.getByText('Open in Discover')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeEnabled();
      });

      it('renders updated table columns and orderby', async () => {
        const eventsMock = mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('title')).toBeInTheDocument();
        expect(
          await screen.findByText('/organizations/:orgId/dashboards/')
        ).toBeInTheDocument();
        expect(eventsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({sort: ['-count()']}),
          })
        );
      });

      it('applies the dashboard filters to the widget query when provided', async () => {
        const eventsMock = mockEvents();
        await renderModal({
          initialData,
          widget: mockWidget,
          dashboardFilters: {release: ['project-release@1.2.0']},
        });
        expect(await screen.findByText('title')).toBeInTheDocument();
        expect(
          await screen.findByText('/organizations/:orgId/dashboards/')
        ).toBeInTheDocument();
        expect(eventsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({
              query:
                // The release was injected into the discover query
                '(title:/organizations/:orgId/insights/summary/) release:"project-release@1.2.0" ',
            }),
          })
        );
      });

      it('renders area chart', async () => {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('echarts mock')).toBeInTheDocument();
      });

      it('renders description', async () => {
        mockEvents();
        await renderModal({
          initialData,
          widget: {...mockWidget, description: 'This is a description'},
        });
        expect(await screen.findByText('This is a description')).toBeInTheDocument();
      });

      it('redirects user to Discover when clicking Open in Discover', async () => {
        mockEvents();
        await renderModal({
          initialData,
          widget: {...mockWidget, widgetType: WidgetType.ERRORS},
        });
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/explore/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=title%3A%2Forganizations%2F%3AorgId%2Finsights%2Fsummary%2F&queryDataset=error-events&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('zooms into the selected time range', async () => {
        mockEvents();
        const {router} = await renderModal({initialData, widget: mockWidget});
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
        await waitFor(() =>
          expect(router.location.query).toEqual(
            expect.objectContaining({
              viewerEnd: '2022-03-01T07:33:20',
              viewerStart: '2022-03-01T02:00:00',
            })
          )
        );
      });

      it('renders multiquery label and selector', async () => {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(
          await screen.findByText(
            'This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.'
          )
        ).toBeInTheDocument();
        expect(screen.getByText('Query Name')).toBeInTheDocument();
      });

      it('updates selected query when selected in the query dropdown', async () => {
        mockEvents();
        const {router} = await renderModal({initialData, widget: mockWidget});
        await userEvent.click(await screen.findByText('Query Name'));
        await userEvent.click(screen.getByText('Another Query Name'));
        await waitFor(() =>
          expect(router.location.query).toEqual(expect.objectContaining({query: '1'}))
        );
        expect(await screen.findByText('Another Query Name')).toBeInTheDocument();
      });

      it('renders the first query if the query index is invalid', async () => {
        mockEvents();
        const initialRouterConfig = {
          ...initialData.initialRouterConfig,
          location: {
            pathname: initialData.initialRouterConfig.location.pathname,
            query: {query: ['7']},
          },
        };

        await renderModal({
          initialData: {...initialData, initialRouterConfig},
          widget: {...mockWidget, widgetType: WidgetType.ERRORS},
        });
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/explore/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=title%3A%2Forganizations%2F%3AorgId%2Finsights%2Fsummary%2F&queryDataset=error-events&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('renders the correct discover query link when there are multiple queries in a widget', async () => {
        mockEvents();
        const initialRouterConfig = {
          ...initialData.initialRouterConfig,
          location: {
            pathname: initialData.initialRouterConfig.location.pathname,
            query: {query: ['1']},
          },
        };
        await renderModal({
          initialData: {...initialData, initialRouterConfig},
          widget: {...mockWidget, widgetType: WidgetType.ERRORS},
        });
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/explore/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=&queryDataset=error-events&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('renders with first legend disabled by default', async () => {
        mockEvents();
        // Rerender with first legend disabled
        const initialRouterConfig = {
          ...initialData.initialRouterConfig,
          location: {
            pathname: initialData.initialRouterConfig.location.pathname,
            query: {
              unselectedSeries: [`${mockWidget.id}:Query Name`],
            },
          },
        };
        await renderModal({
          initialData: {...initialData, initialRouterConfig},
          widget: mockWidget,
        });

        const echartsMock = jest.mocked(ReactEchartsCore);
        const lastCall = echartsMock.mock.calls[echartsMock.mock.calls.length - 1]![0];
        // TODO(react19): Can change this back to expect(ReactEchartsCore).toHaveBeenLastCalledWith()
        expect(lastCall).toEqual(
          expect.objectContaining({
            option: expect.objectContaining({
              legend: expect.objectContaining({
                selected: {[`Query Name|~|${mockWidget.id}`]: false},
              }),
            }),
          })
        );
      });

      it('renders total results in footer', async () => {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('33,323,612')).toBeInTheDocument();
      });

      it('renders highlighted query text and multiple queries in select dropdown', async () => {
        mockEvents();
        await renderModal({
          initialData,
          widget: {
            ...mockWidget,
            queries: [{...mockQuery, name: ''}, additionalMockQuery],
          },
        });
        await userEvent.click(
          await screen.findByText('/organizations/:orgId/insights/summary/')
        );
      });

      it('includes group by in widget viewer table', async () => {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/insights/summary/',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: ['transaction'],
            name: 'Query Name',
            orderby: '-count()',
          },
        ];
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('transaction')).toBeInTheDocument();
      });

      it('includes order by in widget viewer table if not explicitly selected', async () => {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/insights/summary/',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: ['transaction'],
            name: 'Query Name',
            orderby: 'count_unique(user)',
          },
        ];
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('count_unique(user)')).toBeInTheDocument();
      });

      it('includes a custom equation order by in widget viewer table if not explicitly selected', async () => {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/insights/summary/',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: ['transaction'],
            name: 'Query Name',
            orderby: '-equation|count_unique(user) + 1',
          },
        ];
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('count_unique(user) + 1')).toBeInTheDocument();
      });

      it('renders widget chart with y axis formatter using provided seriesResultType', async () => {
        mockEvents();
        await renderModal({
          initialData: initialDataWithFlag,
          widget: mockWidget,
          seriesData: [],
          seriesResultsType: {'count()': 'duration', 'count_unique()': 'duration'},
        });
        const calls = (ReactEchartsCore as jest.Mock).mock.calls;
        const yAxisFormatter =
          calls[calls.length - 1][0].option.yAxis.axisLabel.formatter;
        expect(yAxisFormatter(123)).toBe('123ms');
      });

      it('renders widget chart with default number y axis formatter when seriesResultType has multiple different types', async () => {
        mockEvents();
        await renderModal({
          initialData: initialDataWithFlag,
          widget: mockWidget,
          seriesData: [],
          seriesResultsType: {'count()': 'duration', 'count_unique()': 'size'},
        });
        const calls = (ReactEchartsCore as jest.Mock).mock.calls;
        const yAxisFormatter =
          calls[calls.length - 1][0].option.yAxis.axisLabel.formatter;
        expect(yAxisFormatter(123)).toBe('123');
      });

      it('renders transaction summary link', async () => {
        ProjectsStore.loadInitialData(initialData.projects);
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          body: {
            data: [
              {
                title: '/organizations/:orgId/dashboards/',
                transaction: '/discover/homepage/',
                project: 'project-slug',
                id: '1',
              },
            ],
            meta: {
              fields: {
                title: 'string',
                transaction: 'string',
                project: 'string',
                id: 'string',
              },
              isMetricsData: true,
            },
          },
        });
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/insights/summary/',
            fields: [''],
            aggregates: [''],
            columns: ['transaction'],
            name: 'Query Name',
            orderby: '',
          },
        ];
        await renderModal({
          initialData: initialDataWithFlag,
          widget: mockWidget,
          seriesData: [],
          seriesResultsType: {'count()': 'duration'},
        });

        const link = await screen.findByTestId('widget-viewer-transaction-link');
        expect(link).toHaveAttribute(
          'href',
          expect.stringMatching(
            new RegExp(
              '/organizations/org-slug/insights/summary/?.*project=2&referrer=performance-transaction-summary.*transaction=%2.*'
            )
          )
        );
      });
    });

    describe('TopN Chart Widget', () => {
      let mockQuery!: Widget['queries'][number];
      let mockWidget!: Widget;

      function mockEventsStats() {
        return MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          body: {
            data: [
              [[1646100000], [{count: 1}]],
              [[1646120000], [{count: 1}]],
            ],
            start: 1646100000,
            end: 1646120000,
            isMetricsData: false,
          },
        });
      }

      const eventsMockData = [
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
      ];

      function mockEvents() {
        return MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({cursor: undefined})],
          headers: {
            Link:
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
          },
          body: {
            data: eventsMockData,
            meta: {
              fields: {
                'error.type': 'array',
                count: 'integer',
              },
            },
          },
        });
      }

      beforeEach(() => {
        mockQuery = {
          conditions: 'title:/organizations/:orgId/insights/summary/',
          fields: ['error.type', 'count()'],
          aggregates: ['count()'],
          columns: ['error.type'],
          name: 'Query Name',
          orderby: '',
        };
        mockWidget = {
          title: 'Test Widget',
          displayType: DisplayType.TOP_N,
          interval: '5m',
          queries: [mockQuery],
          widgetType: WidgetType.DISCOVER,
        };

        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({cursor: '0:10:0'})],
          headers: {
            Link:
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:20:0>; rel="next"; results="true"; cursor="0:20:0"',
          },
          body: {
            data: [
              {
                'error.type': ['Next Page Test Error'],
                count: 1,
              },
            ],
            meta: {
              fields: {
                'error.type': 'array',
                count: 'integer',
              },
            },
          },
        });
      });

      it('sorts table when a sortable column header is clicked', async () => {
        const eventsStatsMock = mockEventsStats();
        const eventsMock = mockEvents();
        const {router} = await renderModal({initialData, widget: mockWidget});
        await userEvent.click(await screen.findByText('count()'));
        await waitForMetaToHaveBeenCalled();
        expect(eventsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events/',
          expect.objectContaining({
            query: expect.objectContaining({sort: ['-count()']}),
          })
        );
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({orderby: '-count()'}),
          })
        );
        expect(router.location.query).toEqual(
          expect.objectContaining({sort: '-count()'})
        );
      });

      it('renders pagination buttons', async () => {
        mockEventsStats();
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      });

      it('does not render pagination buttons', async () => {
        mockEventsStats();
        mockEvents();
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          headers: {
            Link:
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:20:0>; rel="next"; results="false"; cursor="0:20:0"',
          },
          body: {
            data: [
              {
                'error.type': ['No Pagination'],
                count: 1,
              },
            ],
            meta: {
              'error.type': 'array',
              count: 'integer',
            },
          },
        });
        await renderModal({initialData, widget: mockWidget});
        expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
      });

      it('paginates to the next page', async () => {
        mockEventsStats();
        mockEvents();
        const {router} = await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('Test Error 1c')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
        await waitForMetaToHaveBeenCalled();
        await waitFor(() =>
          expect(router.location.query).toEqual(
            expect.objectContaining({cursor: '0:10:0', page: '1'})
          )
        );
        expect(await screen.findByText('Next Page Test Error')).toBeInTheDocument();
      });

      it('uses provided seriesData and does not make an events-stats requests', async () => {
        const eventsStatsMock = mockEventsStats();
        mockEvents();
        await renderModal({initialData, widget: mockWidget, seriesData: []});
        expect(eventsStatsMock).not.toHaveBeenCalled();
      });

      it('makes events-stats requests when table is sorted', async () => {
        const eventsStatsMock = mockEventsStats();
        mockEvents();
        await renderModal({
          initialData,
          widget: mockWidget,
          seriesData: [],
        });
        expect(eventsStatsMock).not.toHaveBeenCalled();
        await userEvent.click(screen.getByText('count()'));
        await waitForMetaToHaveBeenCalled();
        expect(eventsStatsMock).toHaveBeenCalled();
      });

      it('appends the orderby to the query if it is not already selected as an aggregate', async () => {
        const eventsStatsMock = mockEventsStats();
        mockEvents();

        const widget = WidgetFixture({
          widgetType: WidgetType.TRANSACTIONS,
          queries: [
            {
              orderby: '-epm()',
              aggregates: ['count()'],
              columns: ['country'],
              conditions: '',
              name: '',
            },
          ],
        });

        await renderModal({initialData, widget});
        expect(await screen.findByText('epm()')).toBeInTheDocument();
        expect(eventsStatsMock).toHaveBeenCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              field: ['country', 'count()', 'epm()'],
            }),
          })
        );
      });
    });

    describe('Table Widget', () => {
      const mockQuery = {
        conditions: 'title:/organizations/:orgId/insights/summary/',
        fields: ['title', 'count()'],
        aggregates: ['count()'],
        columns: ['title'],
        id: '1',
        name: 'Query Name',
        orderby: '',
      };
      const mockWidget = {
        title: 'Test Widget',
        displayType: DisplayType.TABLE,
        interval: '5m',
        queries: [mockQuery],
        widgetType: WidgetType.DISCOVER,
      };
      function mockEvents() {
        return MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          body: {
            data: [
              {
                title: '/organizations/:orgId/dashboards/',
                id: '1',
                count: 1,
              },
            ],
            meta: {
              fields: {
                title: 'string',
                id: 'string',
                count: 1,
              },
              isMetricsData: false,
            },
          },
        });
      }
      it('makes events requests when table is paginated', async () => {
        const eventsMock = mockEvents();
        await renderModal({
          initialData,
          widget: mockWidget,
          tableData: [],
          pageLinks:
            '<https://sentry.io>; rel="previous"; results="false"; cursor="0:0:1", <https://sentry.io>; rel="next"; results="true"; cursor="0:20:0"',
        });
        await act(tick);
        expect(eventsMock).not.toHaveBeenCalled();
        await userEvent.click(await screen.findByLabelText('Next'));
        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });
      });

      it('displays table data with units correctly', async () => {
        const eventsMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({cursor: undefined})],
          headers: {
            Link:
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
              '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
          },
          body: {
            data: [
              {
                'p75(measurements.custom.minute)': 94.87035966318831,
                'p95(measurements.custom.ratio)': 0.9881980140455187,
                'p75(measurements.custom.kibibyte)': 217.87035966318834,
              },
            ],
            meta: {
              fields: {
                'p75(measurements.custom.minute)': 'duration',
                'p95(measurements.custom.ratio)': 'percentage',
                'p75(measurements.custom.kibibyte)': 'size',
              },
              units: {
                'p75(measurements.custom.minute)': 'minute',
                'p95(measurements.custom.ratio)': null,
                'p75(measurements.custom.kibibyte)': 'kibibyte',
              },
              isMetricsData: true,
              tips: {},
            },
          },
        });
        await renderModal({
          initialData: initialDataWithFlag,
          widget: {
            title: 'Custom Widget',
            displayType: 'table',
            queries: [
              {
                fields: [
                  'p75(measurements.custom.kibibyte)',
                  'p75(measurements.custom.minute)',
                  'p95(measurements.custom.ratio)',
                ],
                aggregates: [
                  'p75(measurements.custom.kibibyte)',
                  'p75(measurements.custom.minute)',
                  'p95(measurements.custom.ratio)',
                ],
                columns: [],
                orderby: '-p75(measurements.custom.kibibyte)',
              },
            ],
            widgetType: 'discover',
          },
        });
        await waitFor(() => {
          expect(eventsMock).toHaveBeenCalled();
        });
        expect(screen.getByText('217.9 KiB')).toBeInTheDocument();
        expect(screen.getByText('1.58hr')).toBeInTheDocument();
        expect(screen.getByText('98.82%')).toBeInTheDocument();
      });

      it('disables open in discover button when widget uses performance_score', async () => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
        });

        await renderModal({
          initialData,

          widget: {
            title: 'Custom Widget',
            displayType: 'table',
            queries: [
              {
                fields: ['performance_score(measurements.score.total)'],
                aggregates: ['performance_score(measurements.score.total)'],
                conditions: '',
                columns: [],
                orderby: '',
              },
            ],
            widgetType: 'discover',
          },
        });
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'aria-disabled',
          'true'
        );

        await userEvent.hover(screen.getByRole('button', {name: 'Open in Discover'}));
        expect(await screen.findByText(performanceScoreTooltip)).toBeInTheDocument();
      });
    });
  });

  describe('Issue Table Widget', () => {
    let issuesMock!: jest.Mock;
    const mockQuery = {
      conditions: 'is:unresolved',
      fields: ['events', 'status', 'title'],
      columns: ['events', 'status', 'title'],
      aggregates: [],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      id: '1',
      title: 'Issue Widget',
      displayType: DisplayType.TABLE,
      interval: '5m',
      queries: [mockQuery],
      widgetType: WidgetType.ISSUE,
    };
    beforeEach(() => {
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
    });

    it('renders widget title', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Issue Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open buttons', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Issues')).toBeInTheDocument();
    });

    it('renders events, status, async and title table columns', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Error: Failed')).toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('events')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('unresolved')).toBeInTheDocument();
    });

    it('renders Issue table widget viewer', async () => {
      await renderModal({initialData, widget: mockWidget});
      await screen.findByText('Error: Failed');
    });

    it('redirects user to Issues when clicking Open in Issues', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/?environment=prod&environment=dev&project=1&project=2&query=is%3Aunresolved&sort=&statsPeriod=24h'
      );
    });

    it('sorts table when a sortable column header is clicked', async () => {
      await renderModal({initialData, widget: mockWidget});
      await userEvent.click(screen.getByText('events'));
      await waitFor(() =>
        expect(issuesMock).toHaveBeenCalledWith(
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            data: {
              cursor: undefined,
              environment: ['prod', 'dev'],
              expand: ['owners'],
              limit: 20,
              project: [1, 2],
              query: 'is:unresolved',
              sort: 'date',
              statsPeriod: '24h',
            },
          })
        )
      );
    });

    it('renders pagination buttons', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('paginates to the next page', async () => {
      const {router} = await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Error: Failed')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));
      expect(issuesMock).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(router.location.query).toEqual(
          expect.objectContaining({cursor: '0:10:0', page: '1'})
        )
      );
      expect(await screen.findByText('Another Error: Failed')).toBeInTheDocument();
    });

    it('displays with correct table column widths', async () => {
      const initialRouterConfig = {
        ...initialData.initialRouterConfig,
        location: {
          pathname: initialData.initialRouterConfig.location.pathname,
          query: {width: ['-1', '-1', '575']},
        },
      };
      await renderModal({
        initialData: {...initialData, initialRouterConfig},
        widget: mockWidget,
      });
      expect(await screen.findByTestId('grid-editable')).toHaveStyle({
        'grid-template-columns':
          ' minmax(90px, auto) minmax(90px, auto) minmax(575px, auto)',
      });
    });

    it('uses provided tableData and does not make an issues requests', async () => {
      await renderModal({initialData, widget: mockWidget, tableData: []});
      expect(issuesMock).not.toHaveBeenCalled();
    });
  });

  describe('Release Health Widgets', () => {
    let metricsMock!: jest.Mock;
    let mockQuery: WidgetQuery;
    let mockWidget: Widget;
    beforeEach(() => {
      mockQuery = {
        conditions: '',
        fields: [`sum(session)`],
        columns: [],
        aggregates: ['sum(session)'],
        name: 'Query Name',
        orderby: '',
      };
      mockWidget = {
        id: '1',
        title: 'Release Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [mockQuery],
        widgetType: WidgetType.RELEASE,
      };
      setMockDate(new Date('2022-08-02'));
      metricsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/metrics/data/',
        body: MetricsTotalCountByReleaseIn24h(),
        headers: {
          link:
            '<http://localhost/api/0/organizations/org-slug/metrics/data/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
            '<http://localhost/api/0/organizations/org-slug/metrics/data/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
        },
      });
    });
    afterEach(() => {
      resetMockDate();
    });

    it('does a sessions query', async () => {
      await renderModal({initialData, widget: mockWidget});
      await waitFor(() => {
        expect(metricsMock).toHaveBeenCalled();
      });
    });

    it('renders widget title', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Release Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open in Releases buttons', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Releases')).toBeInTheDocument();
    });

    it('Open in Releases button redirects browser', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(screen.getByRole('button', {name: 'Open in Releases'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/releases/?environment=prod&environment=dev&project=1&project=2&query=&statsPeriod=24h'
      );
    });

    it('renders table header and body', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('release')).toBeInTheDocument();
      expect(await screen.findByText('e102abb2c46e')).toBeInTheDocument();
      expect(screen.getByText('sum(session)')).toBeInTheDocument();
      expect(screen.getByText('6.3k')).toBeInTheDocument();
    });

    it('renders Release widget viewer', async () => {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('e102abb2c46e')).toBeInTheDocument();
    });

    it('renders pagination buttons', async () => {
      await renderModal({
        initialData,
        widget: mockWidget,
      });
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('does not render pagination buttons when sorting by release', async () => {
      // TODO(scttcper): We shouldn't need to wrap render with act, it seems to double render ReleaseWidgetQueries
      await act(() =>
        renderModal({
          initialData,
          widget: {...mockWidget, queries: [{...mockQuery, orderby: 'release'}]},
          // in react 17 act requires that nothing is returned
        }).then(() => void 0)
      );
      expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
    });

    it('makes a new sessions request after sorting by a table column', async () => {
      const {router} = await renderModal({
        initialData,
        widget: mockWidget,
        tableData: [],
        seriesData: [],
      });
      expect(metricsMock).toHaveBeenCalledTimes(1);
      await userEvent.click(await screen.findByText(`sum(session)`), {delay: null});
      await waitFor(() => expect(metricsMock).toHaveBeenCalledTimes(2));
      expect(router.location.query).toEqual(
        expect.objectContaining({sort: '-sum(session)'})
      );
    });

    it('adds the release column to the table if no group by is set', async () => {
      mockQuery = {
        conditions: '',
        fields: [`sum(session)`],
        columns: [],
        aggregates: ['sum(session)'],
        name: 'Query Name',
        orderby: '',
      };
      mockWidget = {
        id: '1',
        title: 'Release Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [mockQuery],
        widgetType: WidgetType.RELEASE,
      };
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('release')).toBeInTheDocument();
      expect(metricsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            groupBy: ['release'],
          }),
        })
      );
    });

    it('does not add a release grouping to the table if a group by is set', async () => {
      mockQuery = {
        conditions: '',
        fields: [],
        columns: ['environment'],
        aggregates: ['sum(session)'],
        name: 'Query Name',
        orderby: '',
      };
      mockWidget = {
        id: '1',
        title: 'Release Widget',
        displayType: DisplayType.LINE,
        interval: '5m',
        queries: [mockQuery],
        widgetType: WidgetType.RELEASE,
      };
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('environment')).toBeInTheDocument();
      expect(metricsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            groupBy: ['environment'],
          }),
        })
      );
    });
  });

  describe('Span Widgets', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
      const projects = [ProjectFixture()];
      initialData = {
        organization: OrganizationFixture({
          features: ['discover-cell-actions-v2'],
        }),
        projects,
        initialRouterConfig: {
          ...defaultInitialRouterConfig,
          location: {...defaultInitialRouterConfig.location},
        },
      };
    });

    it('renders the Open in Explore button', async () => {
      const mockWidget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        queries: [
          {
            fields: ['span.description', 'avg(span.duration)'],
            aggregates: ['avg(span.duration)'],
            columns: ['span.description'],
            conditions: '',
            orderby: '',
            name: '',
          },
        ],
      });
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Open in Explore')).toBeInTheDocument();
    });

    it('does not make an events-stats request with an arbitrary table sort as a y-axis', async () => {
      const eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
      const mockWidget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        queries: [
          {
            fields: [],
            aggregates: ['p90(span.duration)'],
            columns: ['span.description'],
            conditions: '',
            orderby: '-count(span.duration)',
            name: '',
          },
        ],
      });
      await renderModal({initialData, widget: mockWidget});
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            orderby: '-count(span.duration)',

            // The orderby should not appear as a yAxis
            yAxis: ['p90(span.duration)'],

            // The orderby should appear in the field array
            field: ['span.description', 'p90(span.duration)', 'count(span.duration)'],
          }),
        })
      );
    });

    it('links to the spans page when "View span samples" is clicked in the context menu', async () => {
      const mockSpanWidget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        title: 'Span Transactions Widget',
        displayType: DisplayType.TABLE,
        queries: [
          {
            fields: ['transaction', 'count()'],
            aggregates: ['count()'],
            columns: ['transaction'],
            name: '',
            conditions: '',
            orderby: '',
          },
        ],
      });

      const {router} = await renderModal({
        initialData,
        widget: mockSpanWidget,
        tableData: [
          {
            title: 'Span Transactions Widget',
            data: [{transaction: 'test-transaction', count: 10, id: 'test-id'}],
          },
        ],
      });

      const transactionCell = await screen.findByText('test-transaction');
      expect(transactionCell).toBeInTheDocument();

      await userEvent.click(transactionCell);

      const menuOption = await screen.findByText('View span samples');
      expect(menuOption).toBeInTheDocument();

      await userEvent.click(menuOption);

      await waitFor(() =>
        expect(router.location.pathname).toContain(
          '/organizations/org-slug/explore/traces/'
        )
      );
    });
  });
});
