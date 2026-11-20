import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

import {defaultOutput} from './default';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';

const organization = OrganizationFixture();
const timeSeriesUrl = `/organizations/${organization.slug}/events-timeseries/`;
const classifier = TelemetryClassifierFixture({outputType: null, binaryThreshold: null});
const pageFilters = PageFiltersFixture({projects: [1]});

function DefaultVisualization({filter}: {filter: string}) {
  return (
    <defaultOutput.Visualization
      chartType={ChartType.BAR}
      classifier={classifier}
      filter={filter}
      interval="30m"
      pageFilters={pageFilters}
    />
  );
}

describe('defaultOutput', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the raw result value', () => {
    render(<defaultOutput.ResultCell classifier={classifier} value={0.42} />);

    expect(screen.getByText('0.42')).toBeInTheDocument();
  });

  it.each(['all', 'non-matches'])(
    'charts every result once for the %s filter',
    async filter => {
      const request = MockApiClient.addMockResponse({
        url: timeSeriesUrl,
        body: {timeSeries: [TimeSeriesFixture()]},
      });

      render(<DefaultVisualization filter={filter} />, {organization});

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      expect(request).toHaveBeenCalledWith(
        timeSeriesUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'enrichment_attributes',
            yAxis: `count(${RESULT_FIELD})`,
            query: `has:${RESULT_FIELD}`,
            interval: '30m',
            project: [1],
          }),
        })
      );
    }
  );
});
