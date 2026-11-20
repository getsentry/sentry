import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

import {binaryOutput} from './binary';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';
const MATCHES_QUERY = `${RESULT_FIELD}:>=0.8`;
const NON_MATCHES_QUERY = `${RESULT_FIELD}:<0.8`;

const organization = OrganizationFixture();
const timeSeriesUrl = `/organizations/${organization.slug}/events-timeseries/`;
const classifier = TelemetryClassifierFixture();
const pageFilters = PageFiltersFixture({projects: [1]});

function BinaryVisualization({filter}: {filter: string}) {
  return (
    <binaryOutput.Visualization
      chartType={ChartType.BAR}
      classifier={classifier}
      filter={filter}
      interval="30m"
      pageFilters={pageFilters}
    />
  );
}

function mockTimeSeries(query: string, values = TimeSeriesFixture().values) {
  return MockApiClient.addMockResponse({
    url: timeSeriesUrl,
    body: {timeSeries: [TimeSeriesFixture({values})]},
    match: [MockApiClient.matchQuery({query})],
  });
}

describe('binaryOutput', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it.each([
    {filter: 'matches', query: MATCHES_QUERY},
    {filter: 'non-matches', query: NON_MATCHES_QUERY},
    {filter: 'all', query: `has:${RESULT_FIELD}`},
  ])('queries $filter results with $query', ({filter, query}) => {
    expect(binaryOutput.getResultQuery(classifier, filter)).toBe(query);
  });

  it.each([
    {value: 0.9, label: 'True'},
    {value: 0.8, label: 'True'},
    {value: 0.25, label: 'False'},
  ])('shows $value as $label', ({value, label}) => {
    render(<binaryOutput.ResultCell classifier={classifier} value={value} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(String(value))).not.toBeInTheDocument();
  });

  it('charts matches and non-matches separately when showing all', async () => {
    const matchesRequest = mockTimeSeries(MATCHES_QUERY);
    const nonMatchesRequest = mockTimeSeries(NON_MATCHES_QUERY);

    render(<BinaryVisualization filter="all" />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: /more/}));
    expect(screen.getByRole('option', {name: 'Matches'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Non-matches'})).toBeInTheDocument();
    expect(matchesRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          yAxis: `count(${RESULT_FIELD})`,
          interval: '30m',
          project: [1],
        }),
      })
    );
    expect(nonMatchesRequest).toHaveBeenCalledTimes(1);
  });

  it.each([
    {filter: 'matches', query: MATCHES_QUERY, otherQuery: NON_MATCHES_QUERY},
    {filter: 'non-matches', query: NON_MATCHES_QUERY, otherQuery: MATCHES_QUERY},
  ])('charts only $filter', async ({filter, query, otherQuery}) => {
    const request = mockTimeSeries(query);
    const otherRequest = mockTimeSeries(otherQuery);

    render(<BinaryVisualization filter={filter} />, {organization});

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(otherRequest).not.toHaveBeenCalled();
  });

  it('shows an empty state when every value is zero', async () => {
    const zeroes = [
      {value: 0, timestamp: 1729796400000},
      {value: 0, timestamp: 1729798200000},
    ];
    mockTimeSeries(MATCHES_QUERY, zeroes);
    mockTimeSeries(NON_MATCHES_QUERY, zeroes);

    render(<BinaryVisualization filter="all" />, {organization});

    expect(await screen.findByText('No data to plot.')).toBeInTheDocument();
  });
});
