import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

function ApplicationMetricsChart({aggregate}: {aggregate: string}) {
  return (
    <MetricDetectorChart
      detectorDataset={DetectorDataset.METRICS}
      dataset={Dataset.EVENTS_ANALYTICS_PLATFORM}
      aggregate={aggregate}
      interval={3600}
      query=""
      eventTypes={[EventTypes.TRACE_ITEM_METRIC]}
      environment={undefined}
      projectId="1"
      conditions={[]}
      detectionType="static"
      comparisonDelta={undefined}
      sensitivity={undefined}
      thresholdType={undefined}
    />
  );
}

describe('MetricDetectorChart', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('prompts for an equation without querying when the equation is empty', () => {
    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: []},
    });

    render(<ApplicationMetricsChart aggregate="equation|" />, {organization});

    expect(screen.getByText('Enter an equation to preview results')).toBeInTheDocument();
    expect(screen.queryByText('Error loading chart data')).not.toBeInTheDocument();
    expect(eventsStatsRequest).not.toHaveBeenCalled();
  });

  it('queries the equation when it has an expression', async () => {
    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: []},
    });

    render(
      <ApplicationMetricsChart aggregate="equation|sum(value,metric.a,counter,-) * 2" />,
      {organization}
    );

    await waitFor(() => expect(eventsStatsRequest).toHaveBeenCalled());
    expect(
      screen.queryByText('Enter an equation to preview results')
    ).not.toBeInTheDocument();
  });
});
