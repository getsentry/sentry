import {EventsStatsFixture} from 'sentry-fixture/events';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TriggersChart from 'sentry/views/alerts/rules/metric/triggers/chart';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  Dataset,
} from 'sentry/views/alerts/rules/metric/types';

describe('Incident Rules Create', () => {
  let eventStatsMock: jest.Func;
  let eventCountsMock: jest.Func;
  beforeEach(() => {
    eventStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });

    eventCountsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  const api = new MockApiClient();

  it('renders a metric', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        api={api}
        anomalies={[]}
        location={router.location}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        dataset={Dataset.ERRORS}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
        showTotalCount
      />
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('alert-total-events')).toBeInTheDocument();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '9998m',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
        },
      })
    );

    expect(eventCountsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          query: 'event.type:error',
          statsPeriod: '9998m',
          environment: [],
        },
      })
    );
  });

  it('does not show & query total count if showTotalCount === false', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        dataset={Dataset.ERRORS}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
      />
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-total-events')).not.toBeInTheDocument();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '9998m',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
        },
      })
    );

    expect(eventCountsMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          query: 'event.type:error',
          statsPeriod: '9998m',
          environment: [],
        },
      })
    );
  });

  it('queries the errors dataset if dataset is errors', async () => {
    const {organization, project, router} = initializeOrg({
      organization: {features: ['performance-discover-dataset-selector']},
    });

    render(
      <TriggersChart
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        dataset={Dataset.ERRORS}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
        showTotalCount
      />
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('alert-total-events')).toBeInTheDocument();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '9998m',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
          dataset: 'errors',
        },
      })
    );

    expect(eventCountsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          query: 'event.type:error',
          statsPeriod: '9998m',
          environment: [],
          dataset: 'errors',
        },
      })
    );
  });

  it('queries custom metrics using the metricsEnhanced dataset and metrics layer', async () => {
    const {organization, project, router} = initializeOrg({
      organization: {features: ['custom-metrics']},
    });

    render(
      <TriggersChart
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query=""
        timeWindow={1}
        aggregate="count(d:custom/my_metric@seconds)"
        dataset={Dataset.GENERIC_METRICS}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
        showTotalCount
      />
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('alert-total-events')).toBeInTheDocument();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: '',
          statsPeriod: '9998m',
          yAxis: 'count(d:custom/my_metric@seconds)',
          referrer: 'api.organization-event-stats',
          forceMetricsLayer: 'true',
          dataset: 'metricsEnhanced',
        },
      })
    );
  });
});
