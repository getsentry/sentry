import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';

jest.mock('sentry/components/lazyRender', () => ({
  LazyRender: ({children}: {children: React.ReactNode}) => children,
}));

describe('MultiQueryModeContent', function () {
  const {organization, project} = initializeOrg();
  let eventsRequest: any;
  let eventsStatsRequest: any;

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [{key: 'span.op', name: 'span.op'}],
    });
    eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            id: '1',
            'span.duration': 100,
            'transaction.span_id': 'abc123',
            trace: 'trace123',
            project: '2',
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    eventsStatsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'count(span.duration)': {
          data: [
            [1672531200, [{count: 5}]],
            [1672542000, [{count: 10}]],
            [1672552800, [{count: 15}]],
          ],
          order: 0,
          start: 1672531200,
          end: 1672552800,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: [],
    });
  });

  it('disables changing fields for count', async function () {
    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = await screen.findByTestId('section-visualize-0');
    expect(within(section).getByRole('button', {name: 'spans'})).toBeDisabled();
  });

  it('changes to count(span.duration) when using count', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count'}));

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('defaults count_unique argument to span.op', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    const section = await screen.findByTestId('section-visualize-0');

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count_unique(span.op)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.op'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'count_unique'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
    ]);

    await userEvent.click(within(section).getByRole('button', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('option', {name: 'count_unique'}));

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count_unique(span.op)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.op'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates visualization and outdated sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-sort-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'id'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('updates group bys and outdated sorts', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));
    expect(queries).toEqual([
      {
        yAxes: ['count(span.duration)'],
        chartType: 1,
        sortBys: [
          {
            field: 'count(span.duration)',
            kind: 'desc',
          },
        ],
        query: '',
        groupBys: ['span.op'],
        fields: ['id', 'span.duration'],
      },
    ]);
  });

  it('updates query at the correct index', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    // Add chart
    await userEvent.click(screen.getByRole('button', {name: 'Add Query'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-visualize-0');
    await userEvent.click(within(section).getByRole('button', {name: 'count'}));
    await userEvent.click(within(section).getByRole('option', {name: 'avg'}));
    await userEvent.click(within(section).getByRole('button', {name: 'span.duration'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.self_time'}));
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.self_time)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.self_time'],
        groupBys: [],
        query: '',
      },
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
    await userEvent.click(screen.getAllByLabelText('Delete Query')[0]!);
    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);
  });

  it('calls events and stats APIs', async function () {
    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));

    await waitFor(() =>
      expect(eventsStatsRequest).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            field: [],
            interval: '3h',
            orderby: undefined,
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explorer.stats',
            statsPeriod: '7d',
            topEvents: undefined,
            useRpc: '1',
            yAxis: 'count(span.duration)',
          }),
        })
      )
    );
    await waitFor(() =>
      expect(eventsRequest).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            environment: [],
            field: [
              'id',
              'span.duration',
              'transaction.span_id',
              'trace',
              'project',
              'timestamp',
            ],
            per_page: 10,
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explore.multi-query-spans-table',
            sort: '-span.duration',
            statsPeriod: '7d',
            useRpc: '1',
          }),
        })
      )
    );

    // group by requests
    await waitFor(() =>
      expect(eventsStatsRequest).toHaveBeenNthCalledWith(
        2,
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            excludeOther: 0,
            field: ['span.op', 'count(span.duration)'],
            interval: '3h',
            orderby: '-count_span_duration',
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explorer.stats',
            sort: '-count_span_duration',
            statsPeriod: '7d',
            topEvents: '5',
            useRpc: '1',
            yAxis: 'count(span.duration)',
          }),
        })
      )
    );
    await waitFor(() =>
      expect(eventsRequest).toHaveBeenNthCalledWith(
        2,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            environment: [],
            field: ['span.op', 'count(span.duration)'],
            per_page: 10,
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explore.multi-query-spans-table',
            sort: '-count_span_duration',
            statsPeriod: '7d',
            useRpc: '1',
          }),
        })
      )
    );
  });

  it('unstacking group by puts you in sample mode', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.op': 'POST',
            'avg(span.duration)': 147.02002059925093,
          },
          {
            'span.op': 'GET',
            'avg(span.duration)': 1.9993342331511974,
          },
        ],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.field.includes('span.op');
        },
      ],
    });

    let queries: any;
    function Component() {
      queries = useReadQueriesFromLocation();
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {enableRouterMocks: false}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'span.duration',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: '',
      },
    ]);

    const section = screen.getByTestId('section-group-by-0');
    await userEvent.click(within(section).getByRole('button', {name: 'None'}));
    await userEvent.click(within(section).getByRole('option', {name: 'span.op'}));

    await userEvent.click(screen.getAllByTestId('unstack-link')[0]!);

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['count(span.duration)'],
        sortBys: [
          {
            field: 'id',
            kind: 'desc',
          },
        ],
        fields: ['id', 'span.duration'],
        groupBys: [],
        query: 'span.op:POST',
      },
    ]);
  });

  it('sets interval correctly', async function () {
    const router = RouterFixture({
      location: {
        pathname: '/traces/compare',
        query: {
          queries: [
            '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
          ],
        },
      },
    });
    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );

    const section = screen.getByTestId('section-visualization-0');
    expect(
      await within(section).findByRole('button', {name: '3 hours'})
    ).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', {name: '3 hours'}));
    await userEvent.click(within(section).getByRole('option', {name: '30 minutes'}));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/traces/compare',
      query: expect.objectContaining({
        interval: '30m',
        queries: [
          '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
        ],
      }),
    });
  });

  it('renders a save query button', async function () {
    render(<MultiQueryModeContent />, {organization});
    expect(await screen.findByLabelText('Save')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Save'));
    expect(await screen.findByText('A New Query')).toBeInTheDocument();
  });

  it('highlights save button when query has changes', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/`,
      method: 'GET',
      body: {
        query: [
          {
            query: '',
            fields: ['count(span.duration)'],
            groupby: ['span.op'],
            orderby: '-count(span.duration)',
            visualize: [
              {
                chartType: 1,
                yAxes: ['count(span.duration)'],
              },
            ],
            mode: 'aggregate',
          },
        ],
        range: '14d',
        projects: [],
        environment: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/123/visit/`,
      method: 'POST',
    });
    const router = RouterFixture({
      location: {
        pathname: '/traces/compare',
        query: {
          queries: [
            '{"groupBys":[],"query":"","sortBys":["-timestamp"],"yAxes":["avg(span.duration)"]}',
          ],
          id: '123',
        },
      },
    });

    function Component() {
      return <MultiQueryModeContent />;
    }

    render(
      <PageParamsProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <Component />
        </SpanTagsProvider>
      </PageParamsProvider>,
      {router, organization}
    );
    // No good way to check for highlighted css, so we just check for the text
    expect(await screen.findByText('Save')).toBeInTheDocument();
  });
});
