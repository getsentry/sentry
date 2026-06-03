import {type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

function Wrapper({
  children,
  queryParams,
}: {
  children: ReactNode;
  queryParams: ReadableQueryParams;
}) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsQueryParamsProvider
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryParams={queryParams}
        setQueryParams={() => {}}
        removeMetric={() => {}}
        setTraceMetric={() => {}}
      >
        {children}
      </MetricsQueryParamsProvider>
    </MultiMetricsQueryParamsProvider>
  );
}

describe('MetricToolbar', () => {
  let mockAttributesRequest: jest.Mock;
  const project = ProjectFixture({id: '1', slug: 'project-slug'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    mockAttributesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('renders group by selector for equation visualizations', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeEquation('equation|A + B')],
      aggregateSortBys: [{field: 'equation|A + B', kind: 'desc'}],
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryLabel="ƒ1"
        referenceMap={{A: 'sum(value)', B: 'avg(value)'}}
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper queryParams={queryParams}>{children}</Wrapper>
        ),
      }
    );

    expect(await screen.findByRole('button', {name: /Group by/})).toBeInTheDocument();

    // The query is left undefined for the attributes request because
    // we currently don't filter the attributes for equations.
    expect(mockAttributesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/trace-items/attributes/',
      expect.objectContaining({
        query: expect.objectContaining({
          itemType: 'tracemetrics',
          attributeType: ['string', 'number', 'boolean'],
        }),
      })
    );
  });

  it('renders group by selector for function visualizations', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction('sum(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'sum(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryLabel="A"
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper queryParams={queryParams}>{children}</Wrapper>
        ),
      }
    );

    expect(await screen.findByRole('button', {name: /Group by/})).toBeInTheDocument();
  });

  it('merges trace item detail attributes into group by options', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {
          attributeType: 'string',
          key: 'endpoint.attribute',
          name: 'endpoint.attribute',
        },
        {
          attributeType: 'string',
          key: 'shared.attribute',
          name: 'shared.attribute',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            [TraceMetricKnownFieldKey.ID]: 'metric-id',
            [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
            [TraceMetricKnownFieldKey.TRACE]: 'trace-id',
            [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-04-10T14:37:55+00:00',
          },
        ],
        meta: {fields: {}},
      },
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.explore.metric-samples-table',
        }),
      ],
    });
    const mockTraceItemDetailsRequest = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/trace-items/metric-id/',
      asyncDelay: 50,
      body: {
        attributes: [
          {name: 'fallback.string', type: 'str', value: 'value'},
          {name: 'tags[fallback.number,number]', type: 'float', value: 1.23},
          {name: 'tags[fallback.boolean,boolean]', type: 'bool', value: true},
          {name: 'tags[sentry.item_type,number]', type: 'float', value: 0},
          {name: 'shared.attribute', type: 'str', value: 'duplicate'},
        ],
        itemId: 'metric-id',
        meta: {},
        timestamp: '2025-04-10T14:37:55+00:00',
      },
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryLabel="A"
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper
            queryParams={
              new ReadableQueryParams({
                extrapolate: true,
                mode: Mode.SAMPLES,
                query: '',
                cursor: '',
                fields: ['id', 'timestamp'],
                sortBys: [{field: 'timestamp', kind: 'desc'}],
                aggregateCursor: '',
                aggregateFields: [
                  new VisualizeFunction('sum(value,test_metric,distribution,none)'),
                ],
                aggregateSortBys: [
                  {field: 'sum(value,test_metric,distribution,none)', kind: 'desc'},
                ],
              })
            }
          >
            {children}
          </Wrapper>
        ),
      }
    );

    const groupByButton = await screen.findByRole('button', {name: /Group by/});

    await waitFor(() => {
      expect(mockTraceItemDetailsRequest).toHaveBeenCalledTimes(1);
      expect(groupByButton).toBeDisabled();
    });

    await waitFor(() => {
      expect(groupByButton).toBeEnabled();
    });

    await userEvent.click(groupByButton);

    expect(await screen.findByText('endpoint.attribute')).toBeInTheDocument();
    expect(screen.getByText('fallback.string')).toBeInTheDocument();
    expect(screen.getByText('fallback.number')).toBeInTheDocument();
    expect(screen.getByText('fallback.boolean')).toBeInTheDocument();
    expect(screen.getAllByText('shared.attribute')).toHaveLength(1);
    expect(screen.queryByText('tags[fallback.number,number]')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry.item_type')).not.toBeInTheDocument();
  });

  it('merges trace item detail attributes into query builder options on load', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {
          attributeType: 'string',
          key: 'endpoint.attribute',
          name: 'endpoint.attribute',
        },
        {
          attributeType: 'string',
          key: 'shared.attribute',
          name: 'shared.attribute',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            [TraceMetricKnownFieldKey.ID]: 'metric-id',
            [TraceMetricKnownFieldKey.PROJECT_ID]: project.id,
            [TraceMetricKnownFieldKey.TRACE]: 'trace-id',
            [TraceMetricKnownFieldKey.TIMESTAMP]: '2025-04-10T14:37:55+00:00',
          },
        ],
        meta: {fields: {}},
      },
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.explore.metric-samples-table',
        }),
      ],
    });
    const mockTraceItemDetailsRequest = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/trace-items/metric-id/',
      asyncDelay: 50,
      body: {
        attributes: [
          {name: 'fallback.string', type: 'str', value: 'value'},
          {name: 'tags[fallback.number,number]', type: 'float', value: 1.23},
          {name: 'tags[fallback.boolean,boolean]', type: 'bool', value: true},
          {name: 'tags[sentry.item_type,number]', type: 'float', value: 0},
          {name: 'shared.attribute', type: 'str', value: 'duplicate'},
        ],
        itemId: 'metric-id',
        meta: {},
        timestamp: '2025-04-10T14:37:55+00:00',
      },
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryLabel="A"
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper
            queryParams={
              new ReadableQueryParams({
                extrapolate: true,
                mode: Mode.SAMPLES,
                query: '',
                cursor: '',
                fields: ['id', 'timestamp'],
                sortBys: [{field: 'timestamp', kind: 'desc'}],
                aggregateCursor: '',
                aggregateFields: [
                  new VisualizeFunction('sum(value,test_metric,distribution,none)'),
                ],
                aggregateSortBys: [
                  {field: 'sum(value,test_metric,distribution,none)', kind: 'desc'},
                ],
              })
            }
          >
            {children}
          </Wrapper>
        ),
      }
    );

    const searchBuilder = await screen.findByTestId('search-query-builder');
    const searchInput = within(searchBuilder).getByRole('combobox', {
      name: 'Add a search term',
    });

    await waitFor(() => {
      expect(mockTraceItemDetailsRequest).toHaveBeenCalled();
      expect(searchInput).toBeDisabled();
    });

    await waitFor(() => {
      expect(searchInput).toBeEnabled();
    });

    await userEvent.click(searchInput);

    expect(await screen.findByText('endpoint.attribute')).toBeInTheDocument();
    expect(screen.getByText('fallback.string')).toBeInTheDocument();
    expect(screen.getByText('fallback.number')).toBeInTheDocument();
    expect(screen.getByText('fallback.boolean')).toBeInTheDocument();
    expect(screen.getAllByText('shared.attribute')).toHaveLength(1);
    expect(screen.queryByText('tags[fallback.number,number]')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry.item_type')).not.toBeInTheDocument();
  });

  it('does not fetch trace item detail fallback for equation visualizations', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });
    const mockMetricSamplesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [], meta: {fields: {}}},
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.explore.metric-samples-table',
        }),
      ],
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryLabel="ƒ1"
        referenceMap={{A: 'sum(value)', B: 'avg(value)'}}
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper
            queryParams={
              new ReadableQueryParams({
                extrapolate: true,
                mode: Mode.AGGREGATE,
                query: '',
                cursor: '',
                fields: ['id', 'timestamp'],
                sortBys: [{field: 'timestamp', kind: 'desc'}],
                aggregateCursor: '',
                aggregateFields: [new VisualizeEquation('equation|A + B')],
                aggregateSortBys: [{field: 'equation|A + B', kind: 'desc'}],
              })
            }
          >
            {children}
          </Wrapper>
        ),
      }
    );

    expect(await screen.findByRole('button', {name: /Group by/})).toBeInTheDocument();
    expect(mockMetricSamplesRequest).not.toHaveBeenCalled();
  });
});
