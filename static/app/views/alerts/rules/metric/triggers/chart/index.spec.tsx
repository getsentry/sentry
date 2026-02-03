import {EventsStatsFixture} from 'sentry-fixture/events';
import {ThemeFixture} from 'sentry-fixture/theme';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import TriggersChart from 'sentry/views/alerts/rules/metric/triggers/chart';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  Dataset,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

const theme = ThemeFixture();

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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {},
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
        theme={theme}
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

  it('does not show & query total count if showTotalCount === false', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        theme={theme}
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
          dataset: 'errors',
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
          dataset: 'errors',
        },
      })
    );
  });

  it('queries the errors dataset if dataset is errors', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        theme={theme}
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

  it('uses normal sampling for span alerts', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        theme={theme}
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query=""
        timeWindow={1}
        aggregate="count(span.duration)"
        dataset={Dataset.EVENTS_ANALYTICS_PLATFORM}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
        showTotalCount
        traceItemType={TraceItemDataset.SPANS}
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
          statsPeriod: '14d',
          yAxis: 'count(span.duration)',
          referrer: 'api.organization-event-stats',
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
        },
      })
    );
  });

  it('uses sample weighted extrapolation mode for editing a migrated alert', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        theme={theme}
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query=""
        timeWindow={1}
        aggregate="count(span.duration)"
        dataset={Dataset.EVENTS_ANALYTICS_PLATFORM}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        onDataLoaded={() => {}}
        isQueryValid
        showTotalCount
        traceItemType={TraceItemDataset.SPANS}
        extrapolationMode={ExtrapolationMode.NONE}
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
          statsPeriod: '14d',
          yAxis: 'count(span.duration)',
          referrer: 'api.organization-event-stats',
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          extrapolationMode: 'sampleWeighted',
        },
      })
    );
  });
});
