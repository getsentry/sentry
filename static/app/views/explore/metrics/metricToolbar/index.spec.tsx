import {type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/views/explore/components/traceItemSearchQueryBuilder', () => {
  const actual = jest.requireActual(
    'sentry/views/explore/components/traceItemSearchQueryBuilder'
  );

  return {
    ...actual,
    TraceItemSearchQueryBuilder: (props: {
      disabled?: boolean;
      invalidFilterKeys?: string[];
      numberAttributes?: Record<string, unknown>;
    }) => (
      <div
        data-disabled={String(props.disabled ?? false)}
        data-invalid-filter-keys={props.invalidFilterKeys?.join(',') ?? ''}
        data-number-attributes={Object.keys(props.numberAttributes ?? {}).join(',')}
        data-test-id="metrics-filter-search"
      />
    ),
  };
});

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

  beforeEach(() => {
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

  it('renders group by selector for equation visualizations', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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

  it('disables group by selector while trace item attributes are loading', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
      asyncDelay: 50,
    });

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
        new VisualizeFunction('sum(value,loading_group_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'sum(value,loading_group_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <MetricToolbar
        traceMetric={{name: 'loading_group_metric', type: 'distribution'}}
        queryLabel="A"
      />,
      {
        organization,
        additionalWrapper: ({children}: {children: ReactNode}) => (
          <Wrapper queryParams={queryParams}>{children}</Wrapper>
        ),
      }
    );

    expect(screen.getByRole('button', {name: /Group by/})).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /Group by/})).toBeEnabled();
    });
  });
});

describe('Filter', () => {
  let queryParams: ReadableQueryParams;

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    queryParams = new ReadableQueryParams({
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('disables the search bar while trace item attributes are loading', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
      asyncDelay: 50,
    });

    render(<Filter traceMetric={{name: 'pending_metric', type: 'distribution'}} />, {
      organization: OrganizationFixture({
        features: ['tracemetrics-enabled'],
      }),
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <Wrapper queryParams={queryParams}>{children}</Wrapper>
      ),
    });

    expect(screen.getByTestId('metrics-filter-search')).toHaveAttribute(
      'data-disabled',
      'true'
    );

    await waitFor(() => {
      expect(screen.getByTestId('metrics-filter-search')).toHaveAttribute(
        'data-disabled',
        'false'
      );
    });
  });

  it('disables the search bar when the trace metric filter is unavailable', () => {
    render(<Filter traceMetric={{name: '', type: 'distribution'}} />, {
      organization: OrganizationFixture({
        features: ['tracemetrics-enabled'],
      }),
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <Wrapper queryParams={queryParams}>{children}</Wrapper>
      ),
    });

    expect(screen.getByTestId('metrics-filter-search')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  it('passes validated filter keys to the search bar', async () => {
    queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: 'custom.duration:>300 missing.key:value',
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/validate/',
      body: {
        dataset: [],
        environment: [],
        field: [],
        orderby: [],
        projects: [],
        query: {
          error: 'Unknown attribute',
          fields: [
            {
              attrType: 'number',
              error: null,
              name: 'custom.duration',
              valid: true,
            },
            {
              attrType: null,
              error: 'Unknown attribute',
              name: 'missing.key',
              valid: false,
            },
          ],
          valid: false,
        },
        valid: false,
      },
      statusCode: 400,
      match: [
        MockApiClient.matchQuery({query: 'custom.duration:>300 missing.key:value'}),
      ],
    });

    render(<Filter traceMetric={{name: 'test_metric', type: 'distribution'}} />, {
      organization: OrganizationFixture({
        features: ['tracemetrics-enabled'],
      }),
      additionalWrapper: ({children}: {children: ReactNode}) => (
        <Wrapper queryParams={queryParams}>{children}</Wrapper>
      ),
    });

    await waitFor(() => {
      expect(screen.getByTestId('metrics-filter-search')).toHaveAttribute(
        'data-number-attributes',
        expect.stringContaining('custom.duration')
      );
    });
    expect(screen.getByTestId('metrics-filter-search')).toHaveAttribute(
      'data-invalid-filter-keys',
      'missing.key'
    );
  });
});
