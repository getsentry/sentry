import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

function renderEmbed({
  name,
  data,
  level = 'block',
}: {
  data: Record<string, unknown>;
  name: 'errorsQuery' | 'errorsQueryAggregate';
  level?: 'block' | 'inline';
}) {
  const tag = `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
  return render(<SeerMarkdown raw={level === 'inline' ? `See ${tag}` : tag} />);
}

describe('errors query embeds', () => {
  it('previews five error events', async () => {
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

    renderEmbed({
      name: 'errorsQuery',
      data: {
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

    renderEmbed({
      name: 'errorsQueryAggregate',
      data: {
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
    // Grouping fields (title, project) remain alongside the aggregate, so
    // the table still renders instead of a chart.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('seer-chart-content')).not.toBeInTheDocument();

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

  it('renders a chart instead of a table when every aggregate field is a function call', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    const statsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1_700_000_000, [{count: 5}]],
          [1_700_003_600, [{count: 8}]],
        ],
      },
    });

    renderEmbed({
      name: 'errorsQueryAggregate',
      data: {
        query: 'event.type:error',
        fields: ['count()'],
        statsPeriod: '1h',
        title: 'Error count',
      },
    });

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getAllByLabelText('event.type:error').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The table's own fetch is skipped entirely in chart mode.
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

    renderEmbed({
      name: 'errorsQuery',
      data: {query: 'is:unresolved'},
      level: 'inline',
    });

    expect(screen.getByRole('link', {name: 'Error search'})).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
