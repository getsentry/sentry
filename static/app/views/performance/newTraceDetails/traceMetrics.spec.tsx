import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {
  TraceViewMetricsProviderWrapper,
  TraceViewMetricsSection,
} from 'sentry/views/performance/newTraceDetails/traceMetrics';

function CurrentMetricsQuery() {
  const query = useQueryParamsQuery();

  return <output aria-label="Current metrics query">{query}</output>;
}

describe('TraceViewMetricsSection', () => {
  const organization = OrganizationFixture();
  const traceId = '1234567890abcdef1234567890abcdef';
  let eventsRequest: jest.Mock;
  let recentSearchesRequest: jest.Mock;

  function mockTraceMetricAttributes() {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'metric.name',
          name: 'metric.name',
          attributeType: 'string',
          attributeSource: {source_type: 'sentry'},
        },
        {
          key: 'metric.type',
          name: 'metric.type',
          attributeType: 'string',
          attributeSource: {source_type: 'sentry'},
        },
        {
          key: 'metric.unit',
          name: 'metric.unit',
          attributeType: 'string',
          attributeSource: {source_type: 'sentry'},
        },
        {
          key: 'organization.id',
          name: 'organization.id',
          attributeType: 'number',
          attributeSource: {source_type: 'sentry'},
        },
      ],
    });
  }

  beforeEach(() => {
    eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {
          fields: {},
        },
      },
    });
    recentSearchesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
  });

  it('uses trace metric autocomplete suggestions', async () => {
    mockTraceMetricAttributes();

    render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
      </TraceViewMetricsProviderWrapper>,
      {organization}
    );

    await userEvent.click(
      await screen.findByPlaceholderText('Search application metrics for this trace')
    );

    const menu = await screen.findByRole('listbox');
    await waitFor(() => {
      expect(within(menu).getByRole('option', {name: 'metric.name'})).toBeInTheDocument();
    });
    expect(within(menu).getByRole('option', {name: 'metric.type'})).toBeInTheDocument();
    expect(within(menu).getByRole('option', {name: 'metric.unit'})).toBeInTheDocument();
    expect(
      within(menu).queryByRole('option', {name: 'organization.id'})
    ).not.toBeInTheDocument();
  });

  it('disables recent searches', async () => {
    mockTraceMetricAttributes();

    render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
      </TraceViewMetricsProviderWrapper>,
      {organization}
    );

    await userEvent.click(
      await screen.findByPlaceholderText('Search application metrics for this trace')
    );

    const menu = await screen.findByRole('listbox');
    await waitFor(() => {
      expect(within(menu).getByRole('option', {name: 'metric.name'})).toBeInTheDocument();
    });
    expect(recentSearchesRequest).not.toHaveBeenCalled();
  });

  it('excludes span-sourced metrics from the samples query', async () => {
    mockTraceMetricAttributes();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/metric.name/values/`,
      method: 'GET',
      body: [],
    });
    const {router} = render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
        <CurrentMetricsQuery />
      </TraceViewMetricsProviderWrapper>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/traces/trace/${traceId}/`,
            query: {
              metricsQuery: 'metric.name:duration OR metric.name:distribution',
              query: 'unrelated:value',
            },
          },
        },
      }
    );

    await waitFor(() => {
      expect(eventsRequest).toHaveBeenCalled();
    });
    for (const call of eventsRequest.mock.calls) {
      expect(call[1]?.query?.query).toContain(
        '( !has:sentry.metric.source OR !sentry.metric.source:span )'
      );
    }
    expect(eventsRequest.mock.calls.at(-1)?.[1]?.query?.query).toBe(
      `( !has:sentry.metric.source OR !sentry.metric.source:span ) AND ( metric.name:duration OR metric.name:distribution ) trace:[${traceId}]`
    );
    const currentMetricsQuery = screen.getByLabelText(
      'Current metrics query'
    ).textContent;
    expect(currentMetricsQuery).toContain('duration');
    expect(currentMetricsQuery).toContain('distribution');
    expect(currentMetricsQuery).not.toContain('sentry.metric.source');
    expect(router.location.query.metricsQuery).toBe(currentMetricsQuery);
    expect(router.location.query.query).toBe('unrelated:value');
  });

  it('removes the metrics query parameter when the search is cleared', async () => {
    mockTraceMetricAttributes();
    const {router} = render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
      </TraceViewMetricsProviderWrapper>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/traces/trace/${traceId}/`,
            query: {
              metricsQuery: 'metric.name:duration',
              query: 'unrelated:value',
            },
          },
        },
      }
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Clear search query'})
    );

    await waitFor(() => {
      expect(router.location.query.metricsQuery).toBeUndefined();
    });
    expect(router.location.query.query).toBe('unrelated:value');
  });

  it('preserves the initial metrics query from the URL', async () => {
    mockTraceMetricAttributes();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/metric.name/values/`,
      method: 'GET',
      body: [],
    });
    const {router} = render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
        <CurrentMetricsQuery />
      </TraceViewMetricsProviderWrapper>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/traces/trace/${traceId}/`,
            query: {
              metricsQuery: 'metric.name:duration',
              query: 'unrelated:value',
            },
          },
        },
      }
    );

    expect(
      await screen.findByRole('row', {name: /metric\.name:.*duration/})
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Current metrics query')).toHaveTextContent(
        'metric.name:duration'
      );
    });
    expect(eventsRequest.mock.calls.at(-1)?.[1]?.query?.query).toBe(
      `( !has:sentry.metric.source OR !sentry.metric.source:span ) AND ( metric.name:duration ) trace:[${traceId}]`
    );
    expect(router.location.query.query).toBe('unrelated:value');
  });

  it('scopes attribute and value autocomplete requests to the trace', async () => {
    setWindowLocation(
      'http://localhost/organizations/org-slug/performance/trace/trace-id/?timestamp=1700000000'
    );
    const attributesRequest = mockTraceMetricAttributes();
    const valuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/metric.name/values/`,
      method: 'GET',
      body: [
        {
          key: 'metric.name',
          value: 'duration',
        },
      ],
    });

    render(
      <TraceViewMetricsProviderWrapper traceSlug={traceId}>
        <TraceViewMetricsSection />
      </TraceViewMetricsProviderWrapper>,
      {organization}
    );

    await userEvent.click(
      await screen.findByPlaceholderText('Search application metrics for this trace')
    );
    const menu = await screen.findByRole('listbox');
    await userEvent.click(await within(menu).findByRole('option', {name: 'metric.name'}));

    await waitFor(() => {
      expect(attributesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/trace-items/attributes/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: `trace:[${traceId}] ( !has:sentry.metric.source OR !sentry.metric.source:span )`,
            start: '2023-11-14T19:13:20.000',
            end: '2023-11-15T01:13:20.000',
          }),
        })
      );
      expect(valuesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/trace-items/attributes/metric.name/values/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: `trace:[${traceId}] ( !has:sentry.metric.source OR !sentry.metric.source:span )`,
            start: '2023-11-14T19:13:20.000',
            end: '2023-11-15T01:13:20.000',
          }),
        })
      );
    });
  });
});
