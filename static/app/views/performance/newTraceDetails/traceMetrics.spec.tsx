import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {
  TraceViewMetricsProviderWrapper,
  TraceViewMetricsSection,
} from 'sentry/views/performance/newTraceDetails/traceMetrics';

describe('TraceViewMetricsSection', () => {
  const organization = OrganizationFixture();
  const traceId = '1234567890abcdef1234567890abcdef';

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {
          fields: {},
        },
      },
    });
    MockApiClient.addMockResponse({
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

  it('scopes attribute and value autocomplete requests to the trace', async () => {
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
    await userEvent.click(await screen.findByRole('option', {name: 'metric.name'}));

    await waitFor(() => {
      expect(attributesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/trace-items/attributes/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: `trace:[${traceId}]`,
          }),
        })
      );
      expect(valuesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/trace-items/attributes/metric.name/values/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: `trace:[${traceId}]`,
          }),
        })
      );
    });
  });
});
