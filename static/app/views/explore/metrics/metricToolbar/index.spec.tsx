import {type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
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
      features: [
        'tracemetrics-enabled',
        'tracemetrics-ui-refresh',
        'tracemetrics-equations-in-explore',
      ],
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
      features: ['tracemetrics-enabled', 'tracemetrics-ui-refresh'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('sum(value,test_metric,distribution,-)')],
      aggregateSortBys: [{field: 'sum(value,test_metric,distribution,-)', kind: 'desc'}],
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
});
