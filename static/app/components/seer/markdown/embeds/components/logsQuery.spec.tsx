import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

import {getEmbedLinkHref} from './resourceEmbedTestUtils';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const TIME_SERIES = [
  {
    yAxis: 'count(message)',
    meta: {interval: 3_600_000, valueType: 'integer', valueUnit: null},
    values: [
      {timestamp: 1_700_000_000_000, value: 12},
      {timestamp: 1_700_003_600_000, value: null},
      {timestamp: 1_700_007_200_000, value: 30},
    ],
  },
];

function renderEmbed(data: Record<string, unknown>) {
  const tag = `{% logsQuery %}${JSON.stringify(data)}{% /logsQuery %}`;
  return render(<SeerMarkdown raw={tag} />);
}

describe('logs query embed', () => {
  it('builds a logs query using the logs-prefixed params', () => {
    const href = getEmbedLinkHref('logsQuery', 'Error logs', {
      query: 'severity:error',
      mode: 'samples',
      statsPeriod: '24h',
      title: 'Error logs',
    });

    expect(href).toContain('/organizations/org-slug/explore/logs/');
    expect(href).toContain('logsQuery=severity%3Aerror');
    expect(href).toContain('mode=samples');
  });

  it('previews log rows under a timeseries', async () => {
    const timeseries = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: TIME_SERIES},
    });
    const table = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {id: '1', timestamp: '2026-08-27T12:00:00Z', message: 'Connection refused'},
          {id: '2', timestamp: '2026-08-27T12:01:00Z', message: 'Retrying'},
        ],
      },
    });

    renderEmbed({query: 'severity:error', mode: 'samples', statsPeriod: '24h'});

    expect(await screen.findByText('Connection refused')).toBeInTheDocument();
    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();

    await waitFor(() => {
      expect(table).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'ourlogs',
            // The Logs page's own default sample columns.
            field: ['timestamp', 'message'],
            per_page: 5,
            query: 'severity:error',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(timeseries).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'ourlogs',
            // A samples query names no aggregate, so it charts log volume.
            yAxis: ['count(message)'],
          }),
        })
      );
    });
  });

  it('splits a grouped aggregate into a series per group', async () => {
    const timeseries = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: TIME_SERIES},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{severity: 'error', 'count(message)': 42}]},
    });

    renderEmbed({
      query: '',
      mode: 'aggregate',
      groupBy: ['severity'],
      yAxes: ['count(message)'],
      statsPeriod: '7d',
    });

    expect(await screen.findByText('error')).toBeInTheDocument();

    await waitFor(() => {
      expect(timeseries).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            groupBy: ['severity'],
            topEvents: 5,
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

    renderEmbed({query: '', mode: 'aggregate', statsPeriod: '24h'});

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(table).not.toHaveBeenCalled();
  });
});
