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
  const tag = `{% errorsQuery %}${JSON.stringify(data)}{% /errorsQuery %}`;
  return render(<SeerMarkdown raw={level === 'inline' ? `See ${tag}` : tag} />);
}

describe('errors query embed', () => {
  it('previews five error events under a count timeseries', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: Array.from({length: 6}, (_, index) => ({
          id: String(index + 1),
          title: `Error ${index + 1}`,
          project: 'web',
          timestamp: `2026-08-27T12:0${index}:00Z`,
        })),
      },
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {
        mode: 'samples',
        query: 'event.type:error',
        fields: ['title', 'project', 'timestamp'],
        sort: '-timestamp',
        statsPeriod: '24h',
        title: 'Recent errors',
      },
    });

    expect(await screen.findByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText('Error 5')).toBeInTheDocument();
    expect(screen.queryByText('Error 6')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Recent errors'})).toHaveAttribute(
      'href',
      expect.stringContaining('/explore/discover/results/')
    );
    expect(screen.getAllByLabelText('event.type:error').length).toBeGreaterThan(0);

    // The chart accompanies the sample rows rather than replacing them.
    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['title', 'project', 'timestamp'],
            per_page: 5,
            query: 'event.type:error',
            sort: '-timestamp',
            statsPeriod: '24h',
          }),
        })
      );
    });

    // A non-aggregate query has no aggregate of its own, so it charts a plain
    // event count over the period.
    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:error',
            statsPeriod: '24h',
            yAxis: ['count()'],
          }),
        })
      );
    });
  });

  it('previews aggregate results using API field aliases', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            title: 'TypeError',
            project: 'web',
            count_unique_user: 1234,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {
        mode: 'aggregate',
        query: '',
        fields: ['title', 'project', 'count_unique(user)'],
        sort: '-count_unique_user',
        statsPeriod: '1h',
        yAxes: ['count()'],
        title: 'Errors by title',
      },
    });

    expect(await screen.findByText('TypeError')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    // Grouping fields (title, project) remain alongside the aggregate, so the
    // table is still worth rendering — now beneath the chart.
    expect(screen.getByRole('table')).toBeInTheDocument();

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['title', 'project', 'count_unique(user)'],
            per_page: 5,
            sort: '-count_unique_user',
            statsPeriod: '1h',
            yAxis: 'count()',
          }),
        })
      );
    });
  });

  it('charts a grouped aggregate as one total for the period', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{title: 'TypeError', project: 'web', 'count()': 12}]},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: SERIES},
    });

    renderEmbed({
      data: {
        mode: 'aggregate',
        query: 'event.type:error',
        fields: ['title', 'project', 'count()'],
        sort: '-count',
        statsPeriod: '24h',
        title: 'Errors by title',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();

    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:error',
            statsPeriod: '24h',
            yAxis: ['count()'],
          }),
        })
      );
    });

    // The grouping columns must not reach events-stats: the endpoint groups by
    // whatever `field` it is given, which would split the total into a series
    // per group. Breaking results out by group is the table's job.
    const [, options] = statsRequest.mock.calls.at(-1)!;
    expect(options.query).not.toHaveProperty('field');
    expect(options.query).not.toHaveProperty('topEvents');
  });

  it('renders a chart instead of a table when every aggregate field is a function call', async () => {
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
        mode: 'aggregate',
        query: 'event.type:error',
        fields: ['count()'],
        statsPeriod: '1h',
        title: 'Error count',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getAllByLabelText('event.type:error').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The table's own fetch is skipped entirely in chart-only mode.
    expect(eventsRequest).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(statsRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:error',
            statsPeriod: '1h',
            yAxis: ['count()'],
          }),
        })
      );
    });
  });

  it('does not fetch data for an inline embed', () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: []},
    });

    renderEmbed({
      // No `mode`, so this also pins the schema default. `errorsQuery` shipped
      // before the mode existed, and samples is what it used to do.
      data: {query: 'is:unresolved'},
      level: 'inline',
    });

    expect(screen.getByRole('link', {name: 'Error search'})).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    expect(statsRequest).not.toHaveBeenCalled();
  });
});
