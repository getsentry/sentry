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
  const {organization, project} = initializeOrg({
    organization: {
      features: ['visibility-explore-rpc'],
    },
  });
  let eventsRequest: any;
  let eventsStatsRequest: any;

  beforeEach(function () {
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

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
      body: {},
    });
    eventsStatsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
        chartType: 1,
        sortBys: [
          {
            field: 'avg(span.duration)',
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
            interval: '1h',
            orderby: undefined,
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explorer.stats',
            statsPeriod: '7d',
            topEvents: undefined,
            useRpc: '1',
            yAxis: 'avg(span.duration)',
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
            field: ['span.op', 'avg(span.duration)'],
            interval: '1h',
            orderby: '-avg_span_duration',
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explorer.stats',
            sort: '-avg_span_duration',
            statsPeriod: '7d',
            topEvents: '5',
            useRpc: '1',
            yAxis: 'avg(span.duration)',
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
            field: ['span.op', 'avg(span.duration)'],
            per_page: 10,
            project: ['2'],
            query: '!transaction.span_id:00',
            referrer: 'api.explore.multi-query-spans-table',
            sort: '-avg_span_duration',
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
      {disableRouterMocks: true}
    );

    expect(queries).toEqual([
      {
        chartType: 1,
        yAxes: ['avg(span.duration)'],
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
        yAxes: ['avg(span.duration)'],
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
      await within(section).findByRole('button', {name: '1 hour'})
    ).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', {name: '1 hour'}));
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
});
