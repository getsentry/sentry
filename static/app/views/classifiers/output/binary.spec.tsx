import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

import {binaryOutput} from './binary';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';
const MATCHES_QUERY = `${RESULT_FIELD}:>=0.8`;
const NON_MATCHES_QUERY = `${RESULT_FIELD}:<0.8`;
const HAS_RESULT_QUERY = `has:${RESULT_FIELD}`;
const MATCHES_Y_AXIS = `count_if(\`${MATCHES_QUERY}\`)`;
const NON_MATCHES_Y_AXIS = `count_if(\`${NON_MATCHES_QUERY}\`)`;

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

const ZEROES = [
  {value: 0, timestamp: 1729796400000},
  {value: 0, timestamp: 1729798200000},
];

function mockTimeSeries({
  matches = TimeSeriesFixture().values,
  nonMatches = TimeSeriesFixture().values,
} = {}) {
  return MockApiClient.addMockResponse({
    url: timeSeriesUrl,
    body: {
      timeSeries: [
        TimeSeriesFixture({yAxis: MATCHES_Y_AXIS, values: matches}),
        TimeSeriesFixture({yAxis: NON_MATCHES_Y_AXIS, values: nonMatches}),
      ],
    },
    match: [MockApiClient.matchQuery({query: HAS_RESULT_QUERY})],
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

  it('charts matches and non-matches from one request when showing all', async () => {
    const request = mockTimeSeries();

    render(<BinaryVisualization filter="all" />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: /more/}));
    expect(screen.getByRole('option', {name: 'Matches'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Non-matches'})).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          yAxis: [MATCHES_Y_AXIS, NON_MATCHES_Y_AXIS],
          query: HAS_RESULT_QUERY,
          interval: '30m',
          project: [1],
        }),
      })
    );
  });

  it.each([
    {filter: 'matches', series: {matches: ZEROES}},
    {filter: 'non-matches', series: {nonMatches: ZEROES}},
  ])('charts only $filter', async ({filter, series}) => {
    const request = mockTimeSeries(series);

    render(<BinaryVisualization filter={filter} />, {organization});

    expect(await screen.findByText('No data to plot.')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when every value is zero', async () => {
    mockTimeSeries({matches: ZEROES, nonMatches: ZEROES});

    render(<BinaryVisualization filter="all" />, {organization});

    expect(await screen.findByText('No data to plot.')).toBeInTheDocument();
  });
});
