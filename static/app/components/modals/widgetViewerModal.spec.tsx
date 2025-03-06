import ReactEchartsCore from 'echarts-for-react/lib/core';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {MetricsTotalCountByReleaseIn24h} from 'sentry-fixture/metrics';
import {ProjectFixture} from 'sentry-fixture/project';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
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

let eventsMetaMock: jest.Mock;

const waitForMetaToHaveBeenCalled = async () => {
  await waitFor(() => {
    expect(eventsMetaMock).toHaveBeenCalled();
  });
};

async function renderModal({
  initialData: {organization, router},
  widget,
  seriesData,
  tableData,
  pageLinks,
  seriesResultsType,
  dashboardFilters,
}: {
  initialData: any;
  widget: any;
  dashboardFilters?: DashboardFilters;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
}) {
  const widgetLegendState = new WidgetLegendSelectionState({
    location: router.location,
    dashboard: DashboardFixture([widget], {id: 'new', title: 'Dashboard'}),
    organization,
    router,
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
      router,
      organization,
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

describe('Modals -> WidgetViewerModal', function () {
  let initialData!: ReturnType<typeof initializeOrg>;
  let initialDataWithFlag!: ReturnType<typeof initializeOrg>;
  let widgetLegendState!: WidgetLegendSelectionState;
  beforeEach(() => {
    initialData = initializeOrg({
      organization: {
        features: ['discover-query'],
      },
      projects: [ProjectFixture()],
    });

    initialDataWithFlag = {
      ...initialData,
      organization: {
        ...initialData.organization,
        features: [...initialData.organization.features],
      },
    };

    widgetLegendState = new WidgetLegendSelectionState({
      location: initialData.router.location,
      dashboard: DashboardFixture([], {id: 'new', title: 'Dashboard'}),
      organization: initialData.organization,
      router: initialData.router,
    });

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
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [1, 2],
        environments: ['prod', 'dev'],
        datetime: {start: null, end: null, period: '24h', utc: null},
      },
      new Set()
    );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  describe('Discover Widgets', function () {
    describe('Area Chart Widget', function () {
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

      beforeEach(function () {
        mockQuery = {
          conditions: 'title:/organizations/:orgId/performance/summary/',
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

      it('renders Edit and Open buttons', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
        expect(screen.getByText('Open in Discover')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeEnabled();
      });

      it('renders Open button disabled for discover widget if dataset selector flag enabled', async function () {
        const initData = {
          ...initialData,
          organization: {
            ...initialData.organization,
            features: [
              ...initialData.organization.features,
              'performance-discover-dataset-selector',
            ],
          },
        };
        mockEvents();
        await renderModal({initialData: initData, widget: mockWidget});
        expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
        expect(screen.getByText('Open in Discover')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeDisabled();
      });

      it('renders updated table columns and orderby', async function () {
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

      it('applies the dashboard filters to the widget query when provided', async function () {
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
                '(title:/organizations/:orgId/performance/summary/) release:"project-release@1.2.0" ',
            }),
          })
        );
      });

      it('renders area chart', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('echarts mock')).toBeInTheDocument();
      });

      it('renders description', async function () {
        mockEvents();
        await renderModal({
          initialData,
          widget: {...mockWidget, description: 'This is a description'},
        });
        expect(await screen.findByText('This is a description')).toBeInTheDocument();
      });

      it('redirects user to Discover when clicking Open in Discover', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=title%3A%2Forganizations%2F%3AorgId%2Fperformance%2Fsummary%2F&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('zooms into the selected time range', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
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
          expect(initialData.router.push).toHaveBeenCalledWith(
            expect.objectContaining({
              query: {
                viewerEnd: '2022-03-01T07:33:20',
                viewerStart: '2022-03-01T02:00:00',
              },
            })
          )
        );
      });

      it('renders multiquery label and selector', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(
          await screen.findByText(
            'This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.'
          )
        ).toBeInTheDocument();
        expect(screen.getByText('Query Name')).toBeInTheDocument();
      });

      it('updates selected query when selected in the query dropdown', async function () {
        mockEvents();
        const {rerender} = await renderModal({initialData, widget: mockWidget});
        await userEvent.click(await screen.findByText('Query Name'));
        await userEvent.click(screen.getByText('Another Query Name'));
        expect(initialData.router.replace).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/mock-pathname/',
            query: {query: 1},
          })
        );
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
            widgetLegendState={widgetLegendState}
          />
        );
        await waitForMetaToHaveBeenCalled();
        expect(screen.getByText('Another Query Name')).toBeInTheDocument();
      });

      it('renders the first query if the query index is invalid', async function () {
        mockEvents();
        initialData.router.location.query = {query: ['7']};

        await renderModal({initialData, widget: mockWidget});
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=title%3A%2Forganizations%2F%3AorgId%2Fperformance%2Fsummary%2F&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('renders the correct discover query link when there are multiple queries in a widget', async function () {
        mockEvents();
        initialData.router.location.query = {query: ['1']};
        await renderModal({initialData, widget: mockWidget});
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
          'href',
          '/organizations/org-slug/discover/results/?environment=prod&environment=dev&field=count%28%29&name=Test%20Widget&project=1&project=2&query=&statsPeriod=24h&yAxis=count%28%29'
        );
      });

      it('renders with first legend disabled by default', async function () {
        mockEvents();
        // Rerender with first legend disabled
        initialData.router.location.query = {
          unselectedSeries: [`${mockWidget.id}:Query Name`],
        };
        await renderModal({initialData, widget: mockWidget});
        expect(ReactEchartsCore).toHaveBeenLastCalledWith(
          expect.objectContaining({
            option: expect.objectContaining({
              legend: expect.objectContaining({
                selected: {[`Query Name;${mockWidget.id}`]: false},
              }),
            }),
          }),
          {}
        );
      });

      it('renders total results in footer', async function () {
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('33,323,612')).toBeInTheDocument();
      });

      it('renders highlighted query text and multiple queries in select dropdown', async function () {
        mockEvents();
        await renderModal({
          initialData,
          widget: {
            ...mockWidget,
            queries: [{...mockQuery, name: ''}, additionalMockQuery],
          },
        });
        await userEvent.click(
          await screen.findByText('/organizations/:orgId/performance/summary/')
        );
      });

      it('includes group by in widget viewer table', async function () {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/performance/summary/',
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

      it('includes order by in widget viewer table if not explicitly selected', async function () {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/performance/summary/',
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

      it('includes a custom equation order by in widget viewer table if not explicitly selected', async function () {
        mockEvents();
        mockWidget.queries = [
          {
            conditions: 'title:/organizations/:orgId/performance/summary/',
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

      it('renders widget chart with y axis formatter using provided seriesResultType', async function () {
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

      it('renders widget chart with default number y axis formatter when seriesResultType has multiple different types', async function () {
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

      it('does not allow sorting by transaction name when widget is using metrics', async function () {
        const eventsMock = MockApiClient.addMockResponse({
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
              isMetricsData: true,
            },
          },
        });
        await renderModal({
          initialData: initialDataWithFlag,
          widget: mockWidget,
          seriesData: [],
          seriesResultsType: {'count()': 'duration'},
        });
        expect(eventsMock).toHaveBeenCalledTimes(1);
        expect(screen.getByText('title')).toBeInTheDocument();
        await userEvent.click(screen.getByText('title'));
        expect(initialData.router.push).not.toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/mock-pathname/',
            query: {sort: ['-title']},
          })
        );
      });

      it('renders transaction summary link', async function () {
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
            conditions: 'title:/organizations/:orgId/performance/summary/',
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
            RegExp(
              '/organizations/org-slug/performance/summary/?.*project=2&referrer=performance-transaction-summary.*transaction=%2.*'
            )
          )
        );
      });
    });

    describe('TopN Chart Widget', function () {
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

      beforeEach(function () {
        mockQuery = {
          conditions: 'title:/organizations/:orgId/performance/summary/',
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

      it('sorts table when a sortable column header is clicked', async function () {
        const eventsStatsMock = mockEventsStats();
        const eventsMock = mockEvents();
        const {rerender} = await renderModal({initialData, widget: mockWidget});
        await userEvent.click(await screen.findByText('count()'));
        expect(initialData.router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/mock-pathname/',
            query: {sort: '-count()'},
          })
        );
        // Need to manually set the new router location and rerender to simulate the sortable column click
        initialData.router.location.query = {sort: '-count()'};
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
            widgetLegendState={widgetLegendState}
          />
        );
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
      });

      it('renders pagination buttons', async function () {
        mockEventsStats();
        mockEvents();
        await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      });

      it('does not render pagination buttons', async function () {
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

      it('paginates to the next page', async function () {
        mockEventsStats();
        mockEvents();
        const {rerender} = await renderModal({initialData, widget: mockWidget});
        expect(await screen.findByText('Test Error 1c')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Next'}));
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
            widgetLegendState={widgetLegendState}
          />
        );
        await waitForMetaToHaveBeenCalled();
        expect(await screen.findByText('Next Page Test Error')).toBeInTheDocument();
      });

      it('uses provided seriesData and does not make an events-stats requests', async function () {
        const eventsStatsMock = mockEventsStats();
        mockEvents();
        await renderModal({initialData, widget: mockWidget, seriesData: []});
        expect(eventsStatsMock).not.toHaveBeenCalled();
      });

      it('makes events-stats requests when table is sorted', async function () {
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
        expect(eventsStatsMock).toHaveBeenCalledTimes(1);
      });

      it('appends the orderby to the query if it is not already selected as an aggregate', async function () {
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

    describe('Table Widget', function () {
      const mockQuery = {
        conditions: 'title:/organizations/:orgId/performance/summary/',
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
      it('makes events requests when table is paginated', async function () {
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

      it('displays table data with units correctly', async function () {
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

      it('disables open in discover button when widget uses performance_score', async function () {
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
        expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeDisabled();

        await userEvent.hover(screen.getByRole('button', {name: 'Open in Discover'}));
        expect(await screen.findByText(performanceScoreTooltip)).toBeInTheDocument();
      });
    });
  });

  describe('Issue Table Widget', function () {
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
    });

    it('renders widget title', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Issue Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open buttons', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Issues')).toBeInTheDocument();
    });

    it('renders events, status, async and title table columns', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Error: Failed')).toBeInTheDocument();
      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('events')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('unresolved')).toBeInTheDocument();
    });

    it('renders Issue table widget viewer', async function () {
      await renderModal({initialData, widget: mockWidget});
      await screen.findByText('Error: Failed');
    });

    it('redirects user to Issues when clicking Open in Issues', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/?environment=prod&environment=dev&project=1&project=2&query=is%3Aunresolved&sort=&statsPeriod=24h'
      );
    });

    it('sorts table when a sortable column header is clicked', async function () {
      const {rerender} = await renderModal({initialData, widget: mockWidget});
      await userEvent.click(screen.getByText('events'));
      expect(initialData.router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/mock-pathname/',
          query: {sort: 'freq'},
        })
      );
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
          widgetLegendState={widgetLegendState}
        />
      );
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

    it('renders pagination buttons', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('paginates to the next page', async function () {
      const {rerender} = await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Error: Failed')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));
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
          widgetLegendState={widgetLegendState}
        />
      );
      expect(await screen.findByText('Another Error: Failed')).toBeInTheDocument();
    });

    it('displays with correct table column widths', async function () {
      initialData.router.location.query = {width: ['-1', '-1', '575']};
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByTestId('grid-editable')).toHaveStyle({
        'grid-template-columns':
          ' minmax(90px, auto) minmax(90px, auto) minmax(575px, auto)',
      });
    });

    it('uses provided tableData and does not make an issues requests', async function () {
      await renderModal({initialData, widget: mockWidget, tableData: []});
      expect(issuesMock).not.toHaveBeenCalled();
    });

    it('makes issues requests when table is sorted', async function () {
      await renderModal({
        initialData,
        widget: mockWidget,
        tableData: [],
      });
      expect(issuesMock).not.toHaveBeenCalled();
      await userEvent.click(screen.getByText('events'));
      await waitFor(() => {
        expect(issuesMock).toHaveBeenCalled();
      });
    });
  });

  describe('Release Health Widgets', function () {
    let metricsMock!: jest.Mock;
    const mockQuery = {
      conditions: '',
      fields: [`sum(session)`],
      columns: [],
      aggregates: ['sum(session)'],
      id: '1',
      name: 'Query Name',
      orderby: '',
    };
    const mockWidget = {
      id: '1',
      title: 'Release Widget',
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [mockQuery],
      widgetType: WidgetType.RELEASE,
    };
    beforeEach(function () {
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

    it('does a sessions query', async function () {
      await renderModal({initialData, widget: mockWidget});
      await waitFor(() => {
        expect(metricsMock).toHaveBeenCalled();
      });
    });

    it('renders widget title', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Release Widget')).toBeInTheDocument();
    });

    it('renders Edit and Open in Releases buttons', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('Edit Widget')).toBeInTheDocument();
      expect(screen.getByText('Open in Releases')).toBeInTheDocument();
    });

    it('Open in Releases button redirects browser', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(screen.getByRole('button', {name: 'Open in Releases'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/releases/?environment=prod&environment=dev&project=1&project=2&statsPeriod=24h'
      );
    });

    it('renders table header and body', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('release')).toBeInTheDocument();
      expect(await screen.findByText('e102abb2c46e')).toBeInTheDocument();
      expect(screen.getByText('sum(session)')).toBeInTheDocument();
      expect(screen.getByText('6.3k')).toBeInTheDocument();
    });

    it('renders Release widget viewer', async function () {
      await renderModal({initialData, widget: mockWidget});
      expect(await screen.findByText('e102abb2c46e')).toBeInTheDocument();
    });

    it('renders pagination buttons', async function () {
      await renderModal({
        initialData,
        widget: mockWidget,
      });
      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    });

    it('does not render pagination buttons when sorting by release', async function () {
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

    it('makes a new sessions request after sorting by a table column', async function () {
      const {rerender} = await renderModal({
        initialData,
        widget: mockWidget,
        tableData: [],
        seriesData: [],
      });
      expect(metricsMock).toHaveBeenCalledTimes(1);
      await userEvent.click(await screen.findByText(`sum(session)`), {delay: null});
      expect(initialData.router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/mock-pathname/',
          query: {sort: '-sum(session)'},
        })
      );
      // Need to manually set the new router location and rerender to simulate the sortable column click
      initialData.router.location.query = {sort: '-sum(session)'};
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
          seriesData={[]}
          tableData={[]}
          widgetLegendState={widgetLegendState}
        />
      );
      await waitFor(() => {
        expect(metricsMock).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Span Widgets', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {},
      });
    });

    it('renders the Open in Explore button', async function () {
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
  });
});
