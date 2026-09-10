import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const METRIC = {
  name: 'checkout.latency',
  type: 'distribution',
  unit: 'millisecond',
};

/** The fully qualified spelling Explore recognises for the metric above. */
const QUALIFIED_P95 = 'p95(value,checkout.latency,distribution,millisecond)';
const QUALIFIED_DEFAULT = 'sum(value,checkout.latency,distribution,millisecond)';

const TIME_SERIES = [
  {
    yAxis: QUALIFIED_P95,
    meta: {interval: 3_600_000, valueType: 'duration', valueUnit: 'millisecond'},
    values: [
      {timestamp: 1_700_000_000_000, value: 120},
      {timestamp: 1_700_003_600_000, value: null},
      {timestamp: 1_700_007_200_000, value: 180},
    ],
  },
];

function renderEmbed({
  data,
  level = 'block',
}: {
  data: Record<string, unknown>;
  level?: 'block' | 'inline';
}) {
  const tag = `{% metricsQuery %}${JSON.stringify(data)}{% /metricsQuery %}`;
  return render(<SeerMarkdown raw={level === 'inline' ? `See ${tag}` : tag} />);
}

describe('metrics query embed', () => {
  it('qualifies a bare y-axis with the metric it measures', () => {
    renderEmbed({
      data: {...METRIC, mode: 'aggregate', query: '', yAxes: ['p95(value)']},
      level: 'inline',
    });

    // Seer emits `p95(value)`; Explore only decodes the qualified spelling, and
    // refuses a query that charts nothing.
    const href = screen
      .getByRole('link', {name: METRIC.name})
      .getAttribute('href')
      ?.toString();
    expect(decodeURIComponent(href ?? '')).toContain(QUALIFIED_P95);
    expect(decodeURIComponent(href ?? '')).not.toContain('"p95(value)"');
  });

  it('falls back to the default aggregate for the metric type', () => {
    renderEmbed({
      data: {...METRIC, mode: 'aggregate', query: ''},
      level: 'inline',
    });

    // `distribution` defaults to `sum`, not a blanket `sum(value)`.
    const href = screen
      .getByRole('link', {name: METRIC.name})
      .getAttribute('href')
      ?.toString();
    expect(decodeURIComponent(href ?? '')).toContain(QUALIFIED_DEFAULT);
  });

  it('charts a grouped aggregate above its table', async () => {
    const timeseries = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: TIME_SERIES},
    });
    const table = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {'service.name': 'checkout', [QUALIFIED_P95]: 180},
          {'service.name': 'cart', [QUALIFIED_P95]: 120},
        ],
      },
    });

    renderEmbed({
      data: {
        ...METRIC,
        mode: 'aggregate',
        query: 'release:1.0',
        groupBy: ['service.name'],
        yAxes: ['p95(value)'],
        statsPeriod: '24h',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(await screen.findByText('checkout')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await waitFor(() => {
      expect(timeseries).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'tracemetrics',
            yAxis: [QUALIFIED_P95],
            groupBy: ['service.name'],
            // The identity lives in the y-axis, so the search stays the
            // user's own predicate.
            query: 'release:1.0',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(table).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'tracemetrics',
            field: ['service.name', QUALIFIED_P95],
            per_page: 5,
          }),
        })
      );
    });
  });

  it('drops the table when an aggregate groups by nothing', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: TIME_SERIES},
    });
    const table = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    renderEmbed({
      data: {...METRIC, mode: 'aggregate', query: '', yAxes: ['p95(value)']},
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(table).not.toHaveBeenCalled();
  });

  it('filters samples down to the metric, which has no aggregate to name it', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: TIME_SERIES},
    });
    const table = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{id: '1', 'metric.value': 42, timestamp: '2026-08-27T12:00:00Z'}]},
    });

    renderEmbed({data: {...METRIC, mode: 'samples', query: 'release:1.0'}});

    await waitFor(() => {
      expect(table).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('metric.name:checkout.latency'),
          }),
        })
      );
    });
  });
});
