import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const SERIES = [
  [1_700_000_000, [{count: 5}]],
  [1_700_003_600, [{count: 8}]],
];

function renderEmbed({
  data,
  level = 'block',
}: {
  data: Record<string, unknown>;
  level?: 'block' | 'inline';
}) {
  const tag = `{% spansQuery %}${JSON.stringify(data)}{% /spansQuery %}`;
  return render(<SeerMarkdown raw={level === 'inline' ? `See ${tag}` : tag} />);
}

describe('spans query embed', () => {
  it('previews five span samples under a count timeseries', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: Array.from({length: 6}, (_, index) => ({
          id: String(index + 1),
          'span.description': `GET /api/${index + 1}`,
          'span.duration': 100 + index,
          'span.op': 'http.server',
        })),
      },
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {
        query: 'span.op:http.server',
        mode: 'samples',
        fields: ['span.description', 'span.op', 'span.duration'],
        sort: '-span.duration',
        statsPeriod: '24h',
        title: 'Slow HTTP spans',
      },
    });

    expect(await screen.findByText('GET /api/1')).toBeInTheDocument();
    expect(screen.getByText('GET /api/5')).toBeInTheDocument();
    expect(screen.queryByText('GET /api/6')).not.toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Slow HTTP spans'})).toHaveAttribute(
      'href',
      expect.stringContaining('/explore/traces/')
    );
    expect(screen.getAllByLabelText('span.op:http.server').length).toBeGreaterThan(0);

    // The chart accompanies the sample rows rather than replacing them.
    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            field: ['span.description', 'span.op', 'span.duration'],
            per_page: 5,
            query: 'span.op:http.server',
            sort: '-span.duration',
            statsPeriod: '24h',
          }),
        })
      );
    });

    // A samples query names no aggregate, so it charts Explore's own default
    // visualization as a single total for the period.
    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            query: 'span.op:http.server',
            statsPeriod: '24h',
            yAxis: ['count(span.duration)'],
          }),
        })
      );
    });

    // Without group-by columns there is nothing to break the total into, so the
    // grouping params must stay off the request.
    const [, options] = statsRequest.mock.calls.at(-1)!;
    expect(options.query).not.toHaveProperty('field');
    expect(options.query).not.toHaveProperty('topEvents');
  });

  it('previews aggregate spans using API field aliases', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'span.op': 'http.server',
            p95_span_duration: 1234,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        'http.server': {data: SERIES, order: 0},
        'db.query': {data: SERIES, order: 1},
      },
    });

    renderEmbed({
      data: {
        query: '',
        mode: 'aggregate',
        groupBy: ['span.op'],
        yAxes: ['p95(span.duration)'],
        sort: '-p95_span_duration',
        statsPeriod: '7d',
        title: 'p95 by span op',
      },
    });

    expect(await screen.findByText('http.server')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    // A group-by column is present, so the table is still worth rendering —
    // now beneath the chart.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByTestId('seer-chart-content')).toBeInTheDocument();

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            field: ['span.op', 'p95(span.duration)'],
            per_page: 5,
            sort: '-p95_span_duration',
            statsPeriod: '7d',
          }),
        })
      );
    });
  });

  it('charts a grouped query as one series per top group', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'span.op': 'http.server', p95_span_duration: 1234}]},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        'http.server': {data: SERIES, order: 0},
        'db.query': {data: SERIES, order: 1},
      },
    });

    renderEmbed({
      data: {
        query: 'span.op:http.server',
        mode: 'aggregate',
        groupBy: ['span.op'],
        yAxes: ['p95(span.duration)'],
        sort: '-p95_span_duration',
        statsPeriod: '24h',
        title: 'p95 by span op',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();

    // The grouping column has to reach events-stats: `field` is what makes the
    // endpoint break the result into a series per group, and `topEvents` is
    // what caps how many come back. This is the split Explore's own chart
    // shows, and it lines the series up with the table's rows.
    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            excludeOther: '1',
            field: ['span.op', 'p95(span.duration)'],
            query: 'span.op:http.server',
            sort: '-p95_span_duration',
            statsPeriod: '24h',
            topEvents: '5',
            yAxis: ['p95(span.duration)'],
          }),
        })
      );
    });
  });

  it('ranks top groups by the charted aggregate when the sort names another', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'span.op': 'http.server', count_span_duration: 12}]},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {'http.server': {data: SERIES, order: 0}},
    });

    renderEmbed({
      data: {
        query: '',
        mode: 'aggregate',
        groupBy: ['span.op'],
        // Grouping already spends a series per group, so only the first y-axis
        // is charted — and the sort naming the second cannot rank it.
        yAxes: ['count(span.duration)', 'p95(span.duration)'],
        sort: '-p95_span_duration',
        statsPeriod: '24h',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();

    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['span.op', 'count(span.duration)'],
            sort: '-count_span_duration',
            topEvents: '5',
            yAxis: ['count(span.duration)'],
          }),
        })
      );
    });
  });

  it('renders a chart instead of a table when aggregate mode has no groupBy', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {
        query: 'span.op:http.server',
        mode: 'aggregate',
        yAxes: ['count(span.duration)'],
        statsPeriod: '1h',
        title: 'Span count',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getAllByLabelText('span.op:http.server').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The table's own fetch is skipped entirely in chart-only mode.
    expect(eventsRequest).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            query: 'span.op:http.server',
            statsPeriod: '1h',
            yAxis: ['count(span.duration)'],
          }),
        })
      );
    });

    const [, options] = statsRequest.mock.calls.at(-1)!;
    expect(options.query).not.toHaveProperty('topEvents');
  });

  it('does not fetch data for an inline embed', () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {query: 'span.op:http.client', mode: 'samples'},
      level: 'inline',
    });

    expect(screen.getByRole('link', {name: 'Span search'})).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    expect(statsRequest).not.toHaveBeenCalled();
  });
});
